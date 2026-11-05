const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..', '..');
const dbPath = path.join(rootDir, 'data.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS tracked_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    file_key TEXT NOT NULL,
    file_name TEXT DEFAULT 'Figma Document',
    node_id TEXT NOT NULL,
    node_type TEXT DEFAULT 'COMPONENT',
    format TEXT DEFAULT 'png',
    scale REAL DEFAULT 2,
    figma_url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_file_node
    ON tracked_components(file_key, node_id);

  CREATE TABLE IF NOT EXISTS fetch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_id INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    has_changes INTEGER DEFAULT 0,
    change_status TEXT DEFAULT 'baseline',
    diff_pixels INTEGER DEFAULT 0,
    diff_percentage REAL DEFAULT 0,
    diff_image_path TEXT,
    diff_boxes_json TEXT DEFAULT '[]',
    previous_fetch_id INTEGER,
    figma_last_modified TEXT,
    fetched_at TEXT NOT NULL,
    FOREIGN KEY (component_id) REFERENCES tracked_components(id) ON DELETE CASCADE
  );
`);

// Ensure diff_boxes_json column exists for existing databases
try {
  db.exec(`ALTER TABLE fetch_history ADD COLUMN diff_boxes_json TEXT DEFAULT '[]';`);
} catch (e) {
  // Column already exists
}

// Ensure folder_path column exists for tracked_components
try {
  db.exec(`ALTER TABLE tracked_components ADD COLUMN folder_path TEXT DEFAULT '';`);
} catch (e) {
  // Column already exists
}

// Folders table for explicitly created / empty folders
db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tracked_folder ON tracked_components(folder_path);
`);

function normalizeFolderPath(pathStr) {
  if (!pathStr || typeof pathStr !== 'string') return '';
  return pathStr
    .split('/')
    .map(s => s.trim())
    .filter(Boolean)
    .join('/');
}

function getAllFolders() {
  const explicit = db.prepare(`SELECT path FROM folders ORDER BY path ASC`).all().map(r => r.path);
  const fromComps = db.prepare(`
    SELECT DISTINCT folder_path FROM tracked_components
    WHERE folder_path IS NOT NULL AND folder_path != ''
  `).all().map(r => r.folder_path);

  const folderSet = new Set();
  function addWithAncestors(p) {
    const norm = normalizeFolderPath(p);
    if (!norm) return;
    const parts = norm.split('/');
    let curr = '';
    for (const part of parts) {
      curr = curr ? `${curr}/${part}` : part;
      folderSet.add(curr);
    }
  }

  explicit.forEach(addWithAncestors);
  fromComps.forEach(addWithAncestors);

  return Array.from(folderSet).sort();
}

function createFolder(pathStr) {
  const norm = normalizeFolderPath(pathStr);
  if (!norm) throw new Error('Folder path cannot be empty.');
  const now = new Date().toISOString();
  const parts = norm.split('/');
  let curr = '';
  const insertStmt = db.prepare(`INSERT OR IGNORE INTO folders (path, created_at) VALUES (?, ?)`);
  for (const part of parts) {
    curr = curr ? `${curr}/${part}` : part;
    insertStmt.run(curr, now);
  }
  return { path: norm };
}

function resolveSemiRootFolder(fileName, existingFolders = [], currentSubfolder = '') {
  if (!fileName || !fileName.trim()) return currentSubfolder ? normalizeFolderPath(currentSubfolder) : '';
  const cleanFileName = fileName.trim();

  // Find if a root folder already exists matching this file name (case-insensitive)
  const existingRoot = existingFolders.find(
    (f) => f.split('/')[0].toLowerCase() === cleanFileName.toLowerCase()
  );

  const rootName = existingRoot ? existingRoot.split('/')[0] : cleanFileName;

  if (!currentSubfolder || !currentSubfolder.trim()) {
    return rootName;
  }

  const cleanSub = normalizeFolderPath(currentSubfolder);
  if (!cleanSub) return rootName;

  // If currentSubfolder already starts with rootName, return as-is
  if (cleanSub.toLowerCase() === rootName.toLowerCase()) {
    return rootName;
  }
  if (cleanSub.toLowerCase().startsWith(rootName.toLowerCase() + '/')) {
    return cleanSub;
  }

  return `${rootName}/${cleanSub}`;
}

function parseFigmaUrl(urlStr) {
  if (!urlStr) return null;
  try {
    const url = new URL(urlStr.trim());
    const pathMatch = url.pathname.match(/\/(file|design|proto|board)\/([a-zA-Z0-9_-]+)(?:\/([^/?#]+))?/);
    const fileKey = pathMatch ? pathMatch[2] : null;
    let fileName = null;
    if (pathMatch && pathMatch[3]) {
      fileName = decodeURIComponent(pathMatch[3]).replace(/[-_]+/g, ' ').trim();
    }
    let nodeId = url.searchParams.get('node-id');
    if (nodeId) {
      nodeId = decodeURIComponent(nodeId).replace(/-/g, ':');
    }
    if (fileKey || nodeId) {
      return { fileKey, nodeId, fileName };
    }
  } catch (e) {
    const rawFileMatch = urlStr.match(/\/(file|design|proto|board)\/([a-zA-Z0-9_-]+)(?:\/([^/?#]+))?/);
    const rawNodeMatch = urlStr.match(/node-id=([^&]+)/);
    let fileName = null;
    if (rawFileMatch && rawFileMatch[3]) {
      fileName = decodeURIComponent(rawFileMatch[3]).replace(/[-_]+/g, ' ').trim();
    }
    if (rawFileMatch || rawNodeMatch) {
      return {
        fileKey: rawFileMatch ? rawFileMatch[2] : null,
        nodeId: rawNodeMatch ? decodeURIComponent(rawNodeMatch[1]).replace(/-/g, ':') : null,
        fileName
      };
    }
  }
  return null;
}

function renameFolder(oldPath, newPath) {
  const oldNorm = normalizeFolderPath(oldPath);
  const newNorm = normalizeFolderPath(newPath);
  if (!oldNorm || !newNorm) throw new Error('Both old and new folder paths are required.');
  if (oldNorm === newNorm) return { oldPath: oldNorm, newPath: newNorm };

  // Update tracked_components exact match
  db.prepare(`UPDATE tracked_components SET folder_path = ? WHERE folder_path = ?`).run(newNorm, oldNorm);

  // Update tracked_components subfolders
  const subComponents = db.prepare(`
    SELECT id, folder_path FROM tracked_components WHERE folder_path LIKE ? || '/%'
  `).all(oldNorm);
  const updateCompStmt = db.prepare(`UPDATE tracked_components SET folder_path = ? WHERE id = ?`);
  for (const comp of subComponents) {
    const updated = newNorm + comp.folder_path.slice(oldNorm.length);
    updateCompStmt.run(updated, comp.id);
  }

  // Update folders table
  db.prepare(`UPDATE OR IGNORE folders SET path = ? WHERE path = ?`).run(newNorm, oldNorm);
  db.prepare(`DELETE FROM folders WHERE path = ?`).run(oldNorm);
  const subFolders = db.prepare(`SELECT id, path FROM folders WHERE path LIKE ? || '/%'`).all(oldNorm);
  const updateFolderStmt = db.prepare(`UPDATE OR IGNORE folders SET path = ? WHERE id = ?`);
  for (const f of subFolders) {
    const updated = newNorm + f.path.slice(oldNorm.length);
    updateFolderStmt.run(updated, f.id);
  }

  return { oldPath: oldNorm, newPath: newNorm };
}

function deleteFolder(pathStr, deleteComponents = false) {
  const norm = normalizeFolderPath(pathStr);
  if (!norm) throw new Error('Folder path is required.');

  const isRoot = !norm.includes('/');
  const matchesFileName = db.prepare(`
    SELECT COUNT(*) as count FROM tracked_components WHERE LOWER(file_name) = LOWER(?)
  `).get(norm)?.count > 0;

  if (isRoot || matchesFileName) {
    throw new Error(`The root folder "${norm}" (Figma file name) cannot be deleted.`);
  }

  if (deleteComponents) {
    const comps = db.prepare(`
      SELECT id FROM tracked_components WHERE folder_path = ? OR folder_path LIKE ? || '/%'
    `).all(norm, norm);
    for (const c of comps) {
      deleteComponent(c.id);
    }
  } else {
    const parentPath = norm.includes('/') ? norm.slice(0, norm.lastIndexOf('/')) : '';
    db.prepare(`
      UPDATE tracked_components SET folder_path = ? WHERE folder_path = ?
    `).run(parentPath, norm);

    const subComps = db.prepare(`
      SELECT id, folder_path FROM tracked_components WHERE folder_path LIKE ? || '/%'
    `).all(norm);
    const updateCompStmt = db.prepare(`UPDATE tracked_components SET folder_path = ? WHERE id = ?`);
    for (const c of subComps) {
      const rest = c.folder_path.slice(norm.length);
      const updated = parentPath ? `${parentPath}${rest}` : rest.replace(/^\//, '');
      updateCompStmt.run(updated, c.id);
    }
  }

  db.prepare(`DELETE FROM folders WHERE path = ? OR path LIKE ? || '/%'`).run(norm, norm);
  return { success: true };
}

function getAllComponentsWithStatus() {
  const components = db.prepare(`
    SELECT * FROM tracked_components ORDER BY id ASC
  `).all();

  const latestFetchStmt = db.prepare(`
    SELECT * FROM fetch_history
    WHERE component_id = ?
    ORDER BY id DESC
    LIMIT 2
  `);

  const countFetchStmt = db.prepare(`
    SELECT COUNT(*) as total FROM fetch_history WHERE component_id = ?
  `);

  return components.map(comp => {
    const recentFetches = latestFetchStmt.all(comp.id);
    const totalCount = countFetchStmt.get(comp.id).total;
    return {
      ...comp,
      totalFetches: totalCount,
      latestFetch: recentFetches[0] || null,
      previousFetch: recentFetches[1] || null
    };
  });
}

function getComponentById(id) {
  return db.prepare(`SELECT * FROM tracked_components WHERE id = ?`).get(id);
}

function getComponentByFileAndNode(fileKey, nodeId) {
  return db.prepare(`
    SELECT * FROM tracked_components WHERE file_key = ? AND node_id = ?
  `).get(fileKey, nodeId);
}

function upsertComponent({ name, fileKey, fileName, nodeId, nodeType, format = 'png', scale = 2, figmaUrl = '', folderPath }) {
  const existing = getComponentByFileAndNode(fileKey, nodeId);
  const normalizedFolder = folderPath !== undefined ? normalizeFolderPath(folderPath) : undefined;
  if (normalizedFolder) {
    try {
      createFolder(normalizedFolder);
    } catch (e) {}
  }
  if (existing) {
    db.prepare(`
      UPDATE tracked_components
      SET name = COALESCE(NULLIF(?, ''), name),
          file_name = COALESCE(NULLIF(?, ''), file_name),
          node_type = COALESCE(NULLIF(?, ''), node_type),
          format = COALESCE(NULLIF(?, ''), format),
          scale = COALESCE(?, scale),
          figma_url = COALESCE(NULLIF(?, ''), figma_url),
          folder_path = COALESCE(?, folder_path)
      WHERE id = ?
    `).run(name, fileName, nodeType, format, scale, figmaUrl, normalizedFolder, existing.id);
    return getComponentById(existing.id);
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO tracked_components (name, file_key, file_name, node_id, node_type, format, scale, figma_url, folder_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name || `Node ${nodeId}`,
    fileKey,
    fileName || 'Figma Document',
    nodeId,
    nodeType || 'NODE',
    format || 'png',
    Number(scale) || 2,
    figmaUrl || '',
    normalizedFolder || '',
    now
  );

  return getComponentById(result.lastInsertRowid);
}

function updateComponent(id, { name, fileKey, fileName, nodeId, nodeType, format, scale, figmaUrl, folderPath }) {
  const existing = getComponentById(id);
  if (!existing) return null;

  const newFileKey = fileKey !== undefined ? String(fileKey).trim() : existing.file_key;
  const newNodeId = nodeId !== undefined ? String(nodeId).trim().replace(/-/g, ':') : existing.node_id;

  // Check unique constraint violation on (file_key, node_id)
  const conflict = db.prepare(`
    SELECT id FROM tracked_components WHERE file_key = ? AND node_id = ? AND id != ?
  `).get(newFileKey, newNodeId, id);

  if (conflict) {
    const err = new Error('Another component with this File Key and Node ID already exists in the watchlist.');
    err.code = 'SQLITE_CONSTRAINT';
    throw err;
  }

  const newName = (name !== undefined && name !== null && String(name).trim() !== '') ? String(name).trim() : existing.name;
  const newFileName = fileName !== undefined ? fileName : existing.file_name;
  const newNodeType = nodeType !== undefined ? nodeType : existing.node_type;
  const newFormat = format !== undefined ? format : existing.format;
  const newScale = scale !== undefined ? Number(scale) : existing.scale;
  const newFigmaUrl = figmaUrl !== undefined ? figmaUrl : existing.figma_url;
  const newFolderPath = folderPath !== undefined ? normalizeFolderPath(folderPath) : (existing.folder_path || '');
  if (newFolderPath) {
    try {
      createFolder(newFolderPath);
    } catch (e) {}
  }

  db.prepare(`
    UPDATE tracked_components
    SET name = ?,
        file_key = ?,
        file_name = ?,
        node_id = ?,
        node_type = ?,
        format = ?,
        scale = ?,
        figma_url = ?,
        folder_path = ?
    WHERE id = ?
  `).run(newName, newFileKey, newFileName, newNodeId, newNodeType, newFormat, newScale, newFigmaUrl, newFolderPath, id);

  return getComponentById(id);
}

function deleteComponent(id) {
  const history = getComponentHistory(id, 1000);
  for (const item of history) {
    removeAssetFile(item.image_path);
    removeAssetFile(item.diff_image_path);
  }
  return db.prepare(`DELETE FROM tracked_components WHERE id = ?`).run(id);
}

function getLatestFetchForComponent(componentId) {
  return db.prepare(`
    SELECT * FROM fetch_history
    WHERE component_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(componentId);
}

function getFetchById(fetchId) {
  return db.prepare(`SELECT * FROM fetch_history WHERE id = ?`).get(fetchId);
}

function getComponentHistory(componentId, limit = 50) {
  return db.prepare(`
    SELECT * FROM fetch_history
    WHERE component_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(componentId, limit);
}

function insertFetchRecord({
  componentId,
  imagePath,
  fileHash,
  width = 0,
  height = 0,
  hasChanges = 0,
  changeStatus = 'baseline',
  diffPixels = 0,
  diffPercentage = 0,
  diffImagePath = null,
  diffBoxesJson = '[]',
  previousFetchId = null,
  figmaLastModified = null,
  fetchedAt = new Date().toISOString()
}) {
  const result = db.prepare(`
    INSERT INTO fetch_history (
      component_id, image_path, file_hash, width, height,
      has_changes, change_status, diff_pixels, diff_percentage,
      diff_image_path, diff_boxes_json, previous_fetch_id, figma_last_modified, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    componentId,
    imagePath,
    fileHash,
    width,
    height,
    hasChanges ? 1 : 0,
    changeStatus,
    diffPixels,
    diffPercentage,
    diffImagePath,
    typeof diffBoxesJson === 'string' ? diffBoxesJson : JSON.stringify(diffBoxesJson || []),
    previousFetchId,
    figmaLastModified,
    fetchedAt
  );

  return getFetchById(result.lastInsertRowid);
}

function removeAssetFile(urlPath) {
  if (!urlPath) return;
  try {
    const rel = urlPath.replace(/^\//, '');
    const fullPath = path.join(rootDir, rel);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (e) {
    console.warn('Could not delete asset file:', urlPath, e.message);
  }
}

module.exports = {
  db,
  getAllComponentsWithStatus,
  getComponentById,
  getComponentByFileAndNode,
  upsertComponent,
  updateComponent,
  deleteComponent,
  getLatestFetchForComponent,
  getFetchById,
  getComponentHistory,
  insertFetchRecord,
  normalizeFolderPath,
  getAllFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  resolveSemiRootFolder,
  parseFigmaUrl
};
