const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { PNG } = require('pngjs');
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default || pixelmatchModule;
const { getFetchRunDetails } = require('../repositories/componentRepository');

const { diffsDir, resolveAssetPath } = require('../config/paths');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeParentPageId(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  // If user pasted a URL, extract numeric pageId (e.g. pageId=720906 or /pages/720906/)
  const urlPageIdMatch = trimmed.match(/[?&]pageId=(\d+)/i) || trimmed.match(/\/pages\/(\d+)(?:\/|$)/i);
  if (urlPageIdMatch) {
    return urlPageIdMatch[1];
  }
  // If pure number or alphanumeric ID
  const pureDigits = trimmed.match(/^\d+$/);
  if (pureDigits) {
    return pureDigits[0];
  }
  return trimmed;
}

function getCollabBaseUrl(customUrl) {
  const url = customUrl || process.env.COLLAB_URL || process.env.CONFLUENCE_URL || 'http://collab.lge.com/main';
  return url.replace(/\/+$/, '');
}

function getCollabToken(customToken) {
  return customToken || process.env.COLLAB_TOKEN || process.env.CONFLUENCE_PERSONAL_TOKEN || '';
}

function getCollabConfig() {
  const url = getCollabBaseUrl();
  const token = getCollabToken();
  return {
    collabUrl: url,
    hasToken: Boolean(token && token.trim())
  };
}

/**
 * Validates and retrieves metadata for the parent page
 */
async function verifyParentPage({ parentPageId, collabUrl, token }) {
  const pageId = normalizeParentPageId(parentPageId);
  if (!pageId) {
    throw new Error('Parent Page ID is required.');
  }

  const baseUrl = getCollabBaseUrl(collabUrl);
  const activeToken = getCollabToken(token);

  if (!activeToken) {
    throw new Error('Collab Personal Access Token is required. Please configure it in .env or provide it in the publish dialog.');
  }

  const endpoint = `${baseUrl}/rest/api/content/${encodeURIComponent(pageId)}?expand=space,ancestors,version`;
  const res = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${activeToken}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Authentication failed (${res.status}). Please check your Collab Personal Access Token.`);
    }
    if (res.status === 404) {
      throw new Error(`Parent page with ID "${pageId}" was not found on Collab.`);
    }
    const errText = await res.text();
    throw new Error(`Failed to verify parent page: ${res.status} ${res.statusText} (${errText.slice(0, 200)})`);
  }

  const page = await res.json();
  const spaceKey = page.space ? page.space.key : '';
  const spaceName = page.space ? page.space.name : spaceKey;
  const webui = page._links && page._links.webui ? `${baseUrl}${page._links.webui}` : `${baseUrl}/pages/viewpage.action?pageId=${pageId}`;

  return {
    pageId: page.id,
    title: page.title,
    spaceKey,
    spaceName,
    url: webui
  };
}

function padPngToSize(png, targetWidth, targetHeight) {
  if (png.width === targetWidth && png.height === targetHeight) {
    return png.data;
  }
  const padded = new PNG({ width: targetWidth, height: targetHeight });
  padded.data.fill(0);
  PNG.bitblt(png, padded, 0, 0, png.width, png.height, 0, 0);
  return padded.data;
}

/**
 * Generates a visual pixel diff image if component changed
 */
function createDiffImageIfMissing(prevDiskPath, currDiskPath, compId, runId) {
  try {
    if (!fs.existsSync(prevDiskPath) || !fs.existsSync(currDiskPath)) {
      return null;
    }
    const diffFileName = `diff_collab_run${runId}_comp${compId}.png`;
    const diffDiskPath = path.join(diffsDir, diffFileName);

    if (fs.existsSync(diffDiskPath)) {
      return diffDiskPath;
    }

    const prevBuf = fs.readFileSync(prevDiskPath);
    const currBuf = fs.readFileSync(currDiskPath);

    const prevPng = PNG.sync.read(prevBuf);
    const currPng = PNG.sync.read(currBuf);

    const maxWidth = Math.max(prevPng.width, currPng.width);
    const maxHeight = Math.max(prevPng.height, currPng.height);

    const img1Data = padPngToSize(prevPng, maxWidth, maxHeight);
    const img2Data = padPngToSize(currPng, maxWidth, maxHeight);

    const diffPng = new PNG({ width: maxWidth, height: maxHeight });
    pixelmatch(img1Data, img2Data, diffPng.data, maxWidth, maxHeight, {
      threshold: 0.1,
      includeAA: true
    });

    const diffBuffer = PNG.sync.write(diffPng);
    fs.writeFileSync(diffDiskPath, diffBuffer);
    return diffDiskPath;
  } catch (err) {
    console.warn(`Could not generate diff image for component ${compId}:`, err.message);
    return null;
  }
}

function resolveDiskPath(webPath) {
  if (!webPath) return null;
  const resolved = resolveAssetPath(webPath);
  return resolved && fs.existsSync(resolved) ? resolved : null;
}

/**
 * Uploads a local file as an attachment to a Confluence page
 */
async function uploadAttachment({ baseUrl, token, pageId, diskPath, attachmentName, comment }) {
  if (!diskPath || !fs.existsSync(diskPath)) return null;

  try {
    const fileBuffer = fs.readFileSync(diskPath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, attachmentName);
    if (comment) formData.append('comment', comment);
    formData.append('minorEdit', 'true');

    const uploadUrl = `${baseUrl}/rest/api/content/${encodeURIComponent(pageId)}/child/attachment`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Atlassian-Token': 'nocheck'
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Upload attachment failed for ${attachmentName} (${res.status}): ${errText.slice(0, 150)}`);
      return null;
    }

    const data = await res.json();
    return (data.results && data.results[0]) || null;
  } catch (err) {
    console.warn(`Error uploading attachment ${attachmentName}:`, err.message);
    return null;
  }
}

/**
 * Generates Confluence Storage Format XHTML with multiple decks for each Figma file
 */
function buildCollabStorageXml({ run, items, attachmentsMap }) {
  // Group items by Figma File
  const fileGroups = [];
  const fileMap = new Map();

  for (const item of items) {
    const fileKey = item.file_key || 'unknown';
    const fileName = item.file_name || `Figma File (${fileKey})`;
    const key = `${fileKey}:::${fileName}`;
    if (!fileMap.has(key)) {
      const group = {
        fileKey,
        fileName,
        items: [],
        changedCount: 0,
        unchangedCount: 0,
        baselineCount: 0
      };
      fileMap.set(key, group);
      fileGroups.push(group);
    }
    const group = fileMap.get(key);
    group.items.push(item);
    if (item.change_status === 'changed') group.changedCount++;
    else if (item.change_status === 'unchanged') group.unchangedCount++;
    else group.baselineCount++;
  }

  const executionDate = new Date(run.started_at).toLocaleString();

  let xml = '';

  // 1. Executive Summary Panel at the top
  xml += `<ac:structured-macro ac:name="panel">`;
  xml += `<ac:parameter ac:name="title">📋 Execution Summary &amp; Overview</ac:parameter>`;
  xml += `<ac:parameter ac:name="borderStyle">solid</ac:parameter>`;
  xml += `<ac:parameter ac:name="borderColor">#0052cc</ac:parameter>`;
  xml += `<ac:parameter ac:name="bgColor">#f4f5f7</ac:parameter>`;
  xml += `<ac:parameter ac:name="titleBGColor">#deebff</ac:parameter>`;
  xml += `<ac:rich-text-body>`;
  xml += `<table class="confluenceTable" style="width: 100%; border: none;">`;
  xml += `<tbody>`;
  xml += `<tr>`;
  xml += `<td style="border: none; padding: 6px 12px;"><strong>Run Session:</strong> #${run.id} (${escapeHtml(run.target_name)})</td>`;
  xml += `<td style="border: none; padding: 6px 12px;"><strong>Execution Mode:</strong> ${escapeHtml(run.trigger_type.toUpperCase())}</td>`;
  xml += `<td style="border: none; padding: 6px 12px;"><strong>Captured At:</strong> ${escapeHtml(executionDate)}</td>`;
  xml += `</tr>`;
  xml += `<tr>`;
  xml += `<td style="border: none; padding: 6px 12px;"><strong>Total Components:</strong> ${run.total_items}</td>`;
  xml += `<td style="border: none; padding: 6px 12px;">`;
  xml += `<span style="display: inline-block; background-color: #FFEBE6; color: #DE350B; padding: 2px 8px; border-radius: 3px; font-weight: bold; margin-right: 6px;">🔴 ${run.changed_count} Changed</span> `;
  xml += `<span style="display: inline-block; background-color: #E3FCEF; color: #006644; padding: 2px 8px; border-radius: 3px; font-weight: bold; margin-right: 6px;">🟢 ${run.unchanged_count} Unchanged</span> `;
  xml += `<span style="display: inline-block; background-color: #DEEBFF; color: #0747A6; padding: 2px 8px; border-radius: 3px; font-weight: bold;">🔵 ${run.baseline_count} Baseline</span>`;
  xml += `</td>`;
  xml += `<td style="border: none; padding: 6px 12px;"><strong>Figma Files (Decks):</strong> ${fileGroups.length}</td>`;
  xml += `</tr>`;
  xml += `</tbody>`;
  xml += `</table>`;
  xml += `</ac:rich-text-body>`;
  xml += `</ac:structured-macro>`;

  xml += `<p>&nbsp;</p>`;

  // 2. Collab "Deck of Cards" Container
  // Each Figma file is placed inside a "card" within the master "deck"
  const deckMacroId = crypto.randomUUID();
  xml += `<h3>📁 Figma File Snapshots &amp; Comparison Cards</h3>`;
  xml += `<ac:structured-macro ac:name="deck" ac:schema-version="1" ac:macro-id="${deckMacroId}">`;
  xml += `<ac:parameter ac:name="id">figma-file-deck-run-${run.id}</ac:parameter>`;
  xml += `<ac:rich-text-body>`;

  fileGroups.forEach((group, index) => {
    const cardMacroId = crypto.randomUUID();
    const figmaFileUrl = `https://www.figma.com/design/${encodeURIComponent(group.fileKey)}`;
    const changeBadge = group.changedCount > 0 ? ` (🔴 ${group.changedCount} changed)` : '';
    const cardLabel = `${group.fileName}${changeBadge} [${group.items.length}]`;

    xml += `<ac:structured-macro ac:name="card" ac:schema-version="1" ac:macro-id="${cardMacroId}">`;
    xml += `<ac:parameter ac:name="label">${escapeHtml(cardLabel)}</ac:parameter>`;
    xml += `<ac:rich-text-body>`;

    // Card Header Banner
    xml += `<p style="margin: 8px 0 12px; font-size: 13px;">`;
    xml += `<strong>Figma File:</strong> <a href="${figmaFileUrl}">${escapeHtml(group.fileName)}</a> &nbsp;|&nbsp; `;
    xml += `<strong>File Key:</strong> <code>${escapeHtml(group.fileKey)}</code> &nbsp;|&nbsp; `;
    xml += `<strong>Total Monitored:</strong> ${group.items.length} items &nbsp;|&nbsp; `;
    xml += `<strong>Status:</strong> `;
    if (group.changedCount > 0) {
      xml += `<span style="color: #DE350B; font-weight: bold;">🔴 ${group.changedCount} Changed</span>, `;
    }
    xml += `<span style="color: #006644; font-weight: bold;">🟢 ${group.unchangedCount} Unchanged</span>`;
    if (group.baselineCount > 0) {
      xml += `, <span style="color: #0747A6; font-weight: bold;">🔵 ${group.baselineCount} Baseline</span>`;
    }
    xml += `</p>`;

    // Card Comparison Table
    xml += `<table class="confluenceTable" style="width: 100%; border-collapse: collapse; margin-top: 8px;">`;
    xml += `<thead>`;
    xml += `<tr style="background-color: #F4F5F7;">`;
    xml += `<th class="confluenceTh" style="padding: 8px; border: 1px solid #DFE1E6; width: 220px;">Component</th>`;
    xml += `<th class="confluenceTh" style="padding: 8px; border: 1px solid #DFE1E6; width: 110px; text-align: center;">Status</th>`;
    xml += `<th class="confluenceTh" style="padding: 8px; border: 1px solid #DFE1E6; width: 90px; text-align: center;">Diff %</th>`;
    xml += `<th class="confluenceTh" style="padding: 8px; border: 1px solid #DFE1E6;">Visual Comparison &amp; Snapshots</th>`;
    xml += `</tr>`;
    xml += `</thead>`;
    xml += `<tbody>`;

    group.items.forEach((item) => {
      const figmaNodeUrl = `https://www.figma.com/design/${encodeURIComponent(item.file_key || group.fileKey)}?node-id=${encodeURIComponent(item.node_id)}`;
      const isChanged = item.change_status === 'changed';
      const isUnchanged = item.change_status === 'unchanged';

      let statusColor = 'Blue';
      let statusLabel = 'BASELINE';
      if (isChanged) {
        statusColor = 'Red';
        statusLabel = 'CHANGED';
      } else if (isUnchanged) {
        statusColor = 'Green';
        statusLabel = 'UNCHANGED';
      }

      xml += `<tr>`;

      // Column 1: Component info
      xml += `<td class="confluenceTd" style="padding: 8px; border: 1px solid #DFE1E6; vertical-align: top;">`;
      xml += `<p><strong>${escapeHtml(item.component_name)}</strong></p>`;
      if (item.folder_path) {
        xml += `<p style="font-size: 11px; color: #6B778C; margin: 2px 0;">📁 ${escapeHtml(item.folder_path)}</p>`;
      }
      xml += `<p style="font-size: 11px; margin: 4px 0 0;"><a href="${figmaNodeUrl}">Open in Figma ↗</a></p>`;
      xml += `</td>`;

      // Column 2: Status Macro
      xml += `<td class="confluenceTd" style="padding: 8px; border: 1px solid #DFE1E6; text-align: center; vertical-align: middle;">`;
      xml += `<ac:structured-macro ac:name="status">`;
      xml += `<ac:parameter ac:name="colour">${statusColor}</ac:parameter>`;
      xml += `<ac:parameter ac:name="title">${statusLabel}</ac:parameter>`;
      xml += `</ac:structured-macro>`;
      xml += `</td>`;

      // Column 3: Diff %
      xml += `<td class="confluenceTd" style="padding: 8px; border: 1px solid #DFE1E6; text-align: center; vertical-align: middle;">`;
      if (isChanged) {
        xml += `<strong style="color: #DE350B; font-size: 13px;">${item.diff_percentage || 0}%</strong>`;
        if (item.diff_pixels) {
          xml += `<br/><span style="font-size: 10px; color: #6B778C;">(${item.diff_pixels} px)</span>`;
        }
      } else if (isUnchanged) {
        xml += `<span style="color: #006644;">0%</span>`;
      } else {
        xml += `<span style="color: #0747A6; font-size: 11px;">Initial</span>`;
      }
      xml += `</td>`;

      // Column 4: Visual Snapshots (Embedded Attachments)
      xml += `<td class="confluenceTd" style="padding: 8px; border: 1px solid #DFE1E6; vertical-align: top;">`;

      const currAttName = attachmentsMap.get(`comp_${item.id}_current`);
      const prevAttName = attachmentsMap.get(`comp_${item.id}_prev`);
      const diffAttName = attachmentsMap.get(`comp_${item.id}_diff`);

      if (isChanged) {
        xml += `<table style="border: none; width: 100%; border-collapse: separate; border-spacing: 6px;">`;
        xml += `<tr>`;

        // Baseline (Previous)
        xml += `<td style="border: 1px solid #DFE1E6; border-radius: 4px; padding: 6px; text-align: center; background: #fff; width: 33%;">`;
        xml += `<p style="margin: 0 0 4px; font-size: 11px; font-weight: bold; color: #42526E;">1. Baseline (Previous)</p>`;
        if (prevAttName) {
          xml += `<ac:image ac:thumbnail="true" ac:width="260"><ri:attachment ri:filename="${escapeHtml(prevAttName)}" /></ac:image>`;
        } else {
          xml += `<p style="font-size: 11px; color: #8993A4;">Snapshot not available</p>`;
        }
        xml += `</td>`;

        // Current Run
        xml += `<td style="border: 1px solid #DFE1E6; border-radius: 4px; padding: 6px; text-align: center; background: #fff; width: 33%;">`;
        xml += `<p style="margin: 0 0 4px; font-size: 11px; font-weight: bold; color: #42526E;">2. Current Run</p>`;
        if (currAttName) {
          xml += `<ac:image ac:thumbnail="true" ac:width="260"><ri:attachment ri:filename="${escapeHtml(currAttName)}" /></ac:image>`;
        } else {
          xml += `<p style="font-size: 11px; color: #8993A4;">Snapshot not available</p>`;
        }
        xml += `</td>`;

        // Diff Overlay
        xml += `<td style="border: 1px solid #DE350B; border-radius: 4px; padding: 6px; text-align: center; background: #FFF5F5; width: 33%;">`;
        xml += `<p style="margin: 0 0 4px; font-size: 11px; font-weight: bold; color: #DE350B;">3. Diff Highlight (Pixelmatch)</p>`;
        if (diffAttName) {
          xml += `<ac:image ac:thumbnail="true" ac:width="260"><ri:attachment ri:filename="${escapeHtml(diffAttName)}" /></ac:image>`;
        } else {
          xml += `<p style="font-size: 11px; color: #8993A4;">Diff image not generated</p>`;
        }
        xml += `</td>`;

        xml += `</tr>`;
        xml += `</table>`;
      } else {
        // Unchanged or Baseline
        xml += `<div style="text-align: left; padding: 4px;">`;
        if (currAttName) {
          xml += `<ac:image ac:thumbnail="true" ac:width="280"><ri:attachment ri:filename="${escapeHtml(currAttName)}" /></ac:image>`;
        } else {
          xml += `<p style="font-size: 11px; color: #8993A4;">Snapshot not available</p>`;
        }
        xml += `</div>`;
      }

      xml += `</td>`;
      xml += `</tr>`;
    });

    xml += `</tbody>`;
    xml += `</table>`;

    xml += `</ac:rich-text-body>`;
    xml += `</ac:structured-macro>`; // end card macro
  });

  xml += `</ac:rich-text-body>`;
  xml += `</ac:structured-macro>`; // end deck macro

  return xml;
}

/**
 * Main function: Publishes full Figma Visual Regression Report to Collab
 */
async function publishReportToCollab({
  runId,
  parentPageId,
  pageTitle,
  collabUrl,
  token
}) {
  const normalizedRunId = Number(runId);
  const runDetails = getFetchRunDetails(normalizedRunId);
  if (!runDetails || !runDetails.run) {
    throw new Error(`Run #${runId} not found.`);
  }

  const { run, items } = runDetails;

  // 1. Verify parent page and resolve target space key
  const parent = await verifyParentPage({ parentPageId, collabUrl, token });
  const baseUrl = getCollabBaseUrl(collabUrl);
  const activeToken = getCollabToken(token);

  // 2. Prepare title
  let finalTitle = (pageTitle && pageTitle.trim()) || `Figma Visual Regression Report - Run #${run.id} (${new Date().toLocaleDateString()})`;

  // 3. Create Child Page in Confluence
  const createPagePayload = {
    type: 'page',
    title: finalTitle,
    space: { key: parent.spaceKey },
    ancestors: [{ id: String(parent.pageId) }],
    body: {
      storage: {
        value: `<p>Initializing Figma Visual Regression Report for Run #${run.id}...</p>`,
        representation: 'storage'
      }
    }
  };

  let createRes = await fetch(`${baseUrl}/rest/api/content`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${activeToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createPagePayload)
  });

  // Handle title collision gracefully by appending unique timestamp
  if (!createRes.ok && createRes.status === 400) {
    const errorBody = await createRes.text();
    if (errorBody.includes('already exists') || errorBody.includes('title')) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      finalTitle = `${finalTitle} (${stamp})`;
      createPagePayload.title = finalTitle;
      createRes = await fetch(`${baseUrl}/rest/api/content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createPagePayload)
      });
    }
  }

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Collab page: ${createRes.status} ${createRes.statusText} (${errText.slice(0, 200)})`);
  }

  const createdPage = await createRes.json();
  const newPageId = createdPage.id;

  // 4. Process and upload image attachments to the new page
  const attachmentsMap = new Map();
  const uploadTasks = [];

  for (const item of items) {
    // Current snapshot image
    const currDisk = resolveDiskPath(item.image_path);
    if (currDisk) {
      const attName = `run${run.id}_comp${item.component_id}_curr_${path.basename(currDisk)}`;
      uploadTasks.push(async () => {
        const att = await uploadAttachment({
          baseUrl,
          token: activeToken,
          pageId: newPageId,
          diskPath: currDisk,
          attachmentName: attName,
          comment: `Current snapshot: ${item.component_name}`
        });
        if (att) attachmentsMap.set(`comp_${item.id}_current`, attName);
      });
    }

    // If changed, also upload previous baseline and diff overlay
    if (item.change_status === 'changed') {
      const prevDisk = resolveDiskPath(item.prev_image_path);
      if (prevDisk) {
        const attName = `run${run.id}_comp${item.component_id}_prev_${path.basename(prevDisk)}`;
        uploadTasks.push(async () => {
          const att = await uploadAttachment({
            baseUrl,
            token: activeToken,
            pageId: newPageId,
            diskPath: prevDisk,
            attachmentName: attName,
            comment: `Baseline snapshot: ${item.component_name}`
          });
          if (att) attachmentsMap.set(`comp_${item.id}_prev`, attName);
        });
      }

      // Generate or resolve diff image
      let diffDisk = resolveDiskPath(item.diff_image_path);
      if (!diffDisk && prevDisk && currDisk) {
        diffDisk = createDiffImageIfMissing(prevDisk, currDisk, item.component_id, run.id);
      }
      if (diffDisk) {
        const attName = `run${run.id}_comp${item.component_id}_diff_${path.basename(diffDisk)}`;
        uploadTasks.push(async () => {
          const att = await uploadAttachment({
            baseUrl,
            token: activeToken,
            pageId: newPageId,
            diskPath: diffDisk,
            attachmentName: attName,
            comment: `Diff overlay: ${item.component_name}`
          });
          if (att) attachmentsMap.set(`comp_${item.id}_diff`, attName);
        });
      }
    }
  }

  // Run upload tasks in batches of 4 concurrency
  const batchSize = 4;
  for (let i = 0; i < uploadTasks.length; i += batchSize) {
    const chunk = uploadTasks.slice(i, i + batchSize);
    await Promise.all(chunk.map((fn) => fn()));
  }

  // 5. Build full Confluence Storage XHTML with decks and embedded attachments
  const storageXml = buildCollabStorageXml({ run, items, attachmentsMap });

  // 6. Update the page with the final report content (version 2)
  const updatePayload = {
    id: String(newPageId),
    type: 'page',
    title: finalTitle,
    space: { key: parent.spaceKey },
    body: {
      storage: {
        value: storageXml,
        representation: 'storage'
      }
    },
    version: {
      number: 2
    }
  };

  const updateRes = await fetch(`${baseUrl}/rest/api/content/${encodeURIComponent(newPageId)}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${activeToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatePayload)
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    console.warn(`Update page body warning: ${updateRes.status} ${errText}`);
  }

  const pageUrl = createdPage._links && createdPage._links.webui
    ? `${baseUrl}${createdPage._links.webui}`
    : `${baseUrl}/pages/viewpage.action?pageId=${newPageId}`;

  return {
    success: true,
    pageId: newPageId,
    title: finalTitle,
    spaceKey: parent.spaceKey,
    parentTitle: parent.title,
    pageUrl,
    totalAttached: attachmentsMap.size,
    itemsCount: items.length
  };
}

module.exports = {
  getCollabConfig,
  verifyParentPage,
  publishReportToCollab
};
