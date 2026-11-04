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

function upsertComponent({ name, fileKey, fileName, nodeId, nodeType, format = 'png', scale = 2, figmaUrl = '' }) {
  const existing = getComponentByFileAndNode(fileKey, nodeId);
  if (existing) {
    db.prepare(`
      UPDATE tracked_components
      SET name = COALESCE(NULLIF(?, ''), name),
          file_name = COALESCE(NULLIF(?, ''), file_name),
          node_type = COALESCE(NULLIF(?, ''), node_type),
          format = COALESCE(NULLIF(?, ''), format),
          scale = COALESCE(?, scale),
          figma_url = COALESCE(NULLIF(?, ''), figma_url)
      WHERE id = ?
    `).run(name, fileName, nodeType, format, scale, figmaUrl, existing.id);
    return getComponentById(existing.id);
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO tracked_components (name, file_key, file_name, node_id, node_type, format, scale, figma_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name || `Node ${nodeId}`,
    fileKey,
    fileName || 'Figma Document',
    nodeId,
    nodeType || 'NODE',
    format || 'png',
    Number(scale) || 2,
    figmaUrl || '',
    now
  );

  return getComponentById(result.lastInsertRowid);
}

function updateComponent(id, { name, fileKey, fileName, nodeId, nodeType, format, scale, figmaUrl }) {
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

  db.prepare(`
    UPDATE tracked_components
    SET name = ?,
        file_key = ?,
        file_name = ?,
        node_id = ?,
        node_type = ?,
        format = ?,
        scale = ?,
        figma_url = ?
    WHERE id = ?
  `).run(newName, newFileKey, newFileName, newNodeId, newNodeType, newFormat, newScale, newFigmaUrl, id);

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
  insertFetchRecord
};
