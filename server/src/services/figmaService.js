const path = require('path');
const fs = require('fs');
const {
  upsertComponent,
  getLatestFetchForComponent,
  insertFetchRecord,
  resolveSemiRootFolder,
  parseFigmaUrl,
  getAllFolders
} = require('../repositories/componentRepository');
const { compareWithPreviousFetch } = require('./diffService');
const { getOrCreateThumbnail } = require('./thumbnailService');

const { snapshotsDir } = require('../config/paths');

function normalizeNodeId(nodeId) {
  if (!nodeId) return '';
  return String(nodeId).trim().replace(/-/g, ':');
}

function sanitizeFileSegment(str) {
  return String(str || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Renders node image via Figma REST API and downloads image binary
 */
async function fetchFigmaImageBinary({ token, fileKey, nodeId, format = 'png', scale = 2 }) {
  const headers = { 'X-Figma-Token': token };
  const imagesApiUrl = `https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(nodeId)}&format=${format}&scale=${scale}`;

  const imageResponse = await fetch(imagesApiUrl, { headers });
  const imageData = await imageResponse.json();

  if (!imageResponse.ok) {
    const err = new Error(imageData.message || imageData.err || `Figma API returned status ${imageResponse.status}`);
    err.status = imageResponse.status;
    throw err;
  }

  const remoteImageUrl = imageData.images && imageData.images[nodeId];
  if (!remoteImageUrl) {
    const err = new Error(`Could not render node "${nodeId}". Verify the Node ID exists and is visible.`);
    err.status = 404;
    throw err;
  }

  const binaryRes = await fetch(remoteImageUrl);
  if (!binaryRes.ok) {
    throw new Error(`Failed to download rendered image binary from Figma (${binaryRes.status})`);
  }

  return Buffer.from(await binaryRes.arrayBuffer());
}

/**
 * Fetches node metadata from Figma document
 */
async function fetchFigmaNodeMetadata({ token, fileKey, nodeId, customName = '' }) {
  const metadata = {
    nodeName: customName || `Node ${nodeId}`,
    nodeType: 'COMPONENT',
    fileName: 'Figma Document',
    lastModified: null
  };

  try {
    const headers = { 'X-Figma-Token': token };
    const nodesApiUrl = `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(nodeId)}`;
    const nodeResponse = await fetch(nodesApiUrl, { headers });
    if (nodeResponse.ok) {
      const nodeJson = await nodeResponse.json();
      metadata.fileName = nodeJson.name || 'Figma Document';
      metadata.lastModified = nodeJson.lastModified || null;

      const targetNode = nodeJson.nodes && nodeJson.nodes[nodeId] && nodeJson.nodes[nodeId].document;
      if (targetNode) {
        metadata.nodeName = customName || targetNode.name || nodeId;
        metadata.nodeType = targetNode.type || 'NODE';
      }
    }
  } catch (metaErr) {
    console.warn('Metadata fetch warning:', metaErr.message);
  }

  return metadata;
}

/**
 * Full execution workflow:
 * 1. Download image from Figma
 * 2. Retrieve metadata
 * 3. Persist component in repository
 * 4. Save snapshot in /assets/snapshots
 * 5. Run diff comparison against previous fetch
 * 6. Save fetch record in repository
 */
async function executeComponentFetch({
  token,
  fileKey,
  fileName,
  nodeId,
  format = 'png',
  scale = 2,
  customName = '',
  figmaUrl = '',
  folderPath = '',
  runId = null
}) {
  const cleanFileKey = fileKey.trim();
  const cleanNodeId = normalizeNodeId(nodeId);
  const validFormat = ['png', 'jpg', 'svg', 'pdf'].includes(String(format).toLowerCase())
    ? String(format).toLowerCase()
    : 'png';
  const validScale = Math.min(Math.max(Number(scale) || 2, 0.01), 4);

  // 1. Download image binary
  const imageBuffer = await fetchFigmaImageBinary({
    token,
    fileKey: cleanFileKey,
    nodeId: cleanNodeId,
    format: validFormat,
    scale: validScale
  });

  // 2. Fetch metadata
  const nodeMetadata = await fetchFigmaNodeMetadata({
    token,
    fileKey: cleanFileKey,
    nodeId: cleanNodeId,
    customName
  });

  // Resolve semi-root folder: the Figma document name
  const docFileName = (fileName && fileName.trim() && fileName !== 'Figma Document')
    ? fileName.trim()
    : ((nodeMetadata.fileName && nodeMetadata.fileName !== 'Figma Document')
        ? nodeMetadata.fileName
        : (parseFigmaUrl(figmaUrl)?.fileName || nodeMetadata.fileName || 'Figma Document'));

  const resolvedFolder = resolveSemiRootFolder(docFileName, getAllFolders(), folderPath);

  // 3. Upsert component record
  const componentRecord = upsertComponent({
    name: nodeMetadata.nodeName,
    fileKey: cleanFileKey,
    fileName: (nodeMetadata.fileName && nodeMetadata.fileName !== 'Figma Document') ? nodeMetadata.fileName : (fileName || nodeMetadata.fileName),
    nodeId: cleanNodeId,
    nodeType: nodeMetadata.nodeType,
    format: validFormat,
    scale: validScale,
    figmaUrl,
    folderPath: resolvedFolder
  });

  // 4. Retrieve previous fetch before storing current
  const previousFetch = getLatestFetchForComponent(componentRecord.id);

  // 5. Store image file
  const now = new Date();
  const timestampTag = now.toISOString().replace(/[:.]/g, '-');
  const safeNode = sanitizeFileSegment(cleanNodeId);
  const snapshotFilename = `comp${componentRecord.id}_${safeNode}_${timestampTag}.${validFormat}`;
  const snapshotDiskPath = path.join(snapshotsDir, snapshotFilename);
  fs.writeFileSync(snapshotDiskPath, imageBuffer);
  const localImagePath = `/assets/snapshots/${snapshotFilename}`;

  // Pre-generate thumbnail in background
  getOrCreateThumbnail(localImagePath, 96).catch((err) => {
    console.warn('Background thumbnail generation failed:', err.message);
  });

  // 6. Compare with previous fetch
  const comparison = compareWithPreviousFetch(
    previousFetch,
    imageBuffer,
    validFormat
  );

  // 7. Record fetch in DB
  const currentFetch = insertFetchRecord({
    componentId: componentRecord.id,
    imagePath: localImagePath,
    fileHash: comparison.fileHash,
    width: comparison.width,
    height: comparison.height,
    hasChanges: comparison.hasChanges,
    changeStatus: comparison.changeStatus,
    diffPixels: comparison.diffPixels,
    diffPercentage: comparison.diffPercentage,
    diffImagePath: null,
    diffBoxesJson: '[]',
    previousFetchId: comparison.previousFetchId,
    figmaLastModified: nodeMetadata.lastModified,
    fetchedAt: now.toISOString(),
    runId
  });

  return {
    component: componentRecord,
    currentFetch,
    previousFetch: previousFetch || null
  };
}

module.exports = {
  normalizeNodeId,
  executeComponentFetch,
  fetchFigmaImageBinary,
  fetchFigmaNodeMetadata
};
