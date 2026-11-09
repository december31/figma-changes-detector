const path = require('path');
const dataSourceManager = require('../services/dataSourceManager');

function getActiveDataDir() {
  return dataSourceManager.getActiveDataSource().dir;
}

function getActiveDbPath() {
  return dataSourceManager.getActiveDataSource().dbPath;
}

function getActiveAssetsDir() {
  return dataSourceManager.getActiveDataSource().assetsDir;
}

function getActiveSnapshotsDir() {
  return dataSourceManager.getActiveDataSource().snapshotsDir;
}

function getActiveDiffsDir() {
  return dataSourceManager.getActiveDataSource().diffsDir;
}

function getActiveThumbnailsDir() {
  return dataSourceManager.getActiveDataSource().thumbnailsDir;
}

function resolveAssetPath(relPath) {
  if (!relPath) return null;
  const clean = String(relPath).replace(/^\//, '');
  return path.join(getActiveDataDir(), clean);
}

const pathsExport = {
  getActiveDataDir,
  getActiveDbPath,
  getActiveAssetsDir,
  getActiveSnapshotsDir,
  getActiveDiffsDir,
  getActiveThumbnailsDir,
  resolveAssetPath
};

// Backward-compatible dynamic property getters
Object.defineProperty(pathsExport, 'dataDir', {
  get: getActiveDataDir,
  enumerable: true
});

Object.defineProperty(pathsExport, 'dbPath', {
  get: getActiveDbPath,
  enumerable: true
});

Object.defineProperty(pathsExport, 'assetsDir', {
  get: getActiveAssetsDir,
  enumerable: true
});

Object.defineProperty(pathsExport, 'snapshotsDir', {
  get: getActiveSnapshotsDir,
  enumerable: true
});

Object.defineProperty(pathsExport, 'diffsDir', {
  get: getActiveDiffsDir,
  enumerable: true
});

Object.defineProperty(pathsExport, 'thumbnailsDir', {
  get: getActiveThumbnailsDir,
  enumerable: true
});

module.exports = pathsExport;
