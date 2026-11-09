const path = require('path');
const fs = require('fs');

// If APP_DATA_DIR is provided (e.g. by Electron app.getPath('userData')), use it;
// otherwise default to server root directory (server/)
const dataDir = process.env.APP_DATA_DIR || path.resolve(__dirname, '..', '..');

const dbPath = path.join(dataDir, 'data.db');
const assetsDir = path.join(dataDir, 'assets');
const snapshotsDir = path.join(assetsDir, 'snapshots');
const diffsDir = path.join(assetsDir, 'diffs');
const thumbnailsDir = path.join(assetsDir, 'thumbnails');

// Ensure storage directories exist
fs.mkdirSync(snapshotsDir, { recursive: true });
fs.mkdirSync(diffsDir, { recursive: true });
fs.mkdirSync(thumbnailsDir, { recursive: true });

function resolveAssetPath(relPath) {
  if (!relPath) return null;
  const clean = String(relPath).replace(/^\//, '');
  return path.join(dataDir, clean);
}

module.exports = {
  dataDir,
  dbPath,
  assetsDir,
  snapshotsDir,
  diffsDir,
  thumbnailsDir,
  resolveAssetPath
};
