const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

// Root data directory (e.g. %APPDATA%/Figma Changes Detector/data on Windows or server/ in dev)
const baseDataDir = process.env.APP_DATA_DIR || path.resolve(__dirname, '..', '..');
const datasourcesDir = path.join(baseDataDir, 'datasources');
const registryFile = path.join(baseDataDir, 'datasources.json');

// Callback registered by componentRepository to re-open DB connection upon switch
let onDatabaseSwitchCallback = null;

function setOnDatabaseSwitch(callback) {
  onDatabaseSwitchCallback = callback;
}

/**
 * Ensures a directory and its asset subfolders exist
 */
function ensureDataSourceDirs(dsDir) {
  const assetsDir = path.join(dsDir, 'assets');
  const snapshotsDir = path.join(assetsDir, 'snapshots');
  const diffsDir = path.join(assetsDir, 'diffs');
  const thumbnailsDir = path.join(assetsDir, 'thumbnails');

  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.mkdirSync(diffsDir, { recursive: true });
  fs.mkdirSync(thumbnailsDir, { recursive: true });

  return {
    dir: dsDir,
    dbPath: path.join(dsDir, 'data.db'),
    assetsDir,
    snapshotsDir,
    diffsDir,
    thumbnailsDir
  };
}

/**
 * Auto-migrates legacy single data.db & assets/ into datasources/default/
 */
function initializeRegistry() {
  fs.mkdirSync(datasourcesDir, { recursive: true });

  if (fs.existsSync(registryFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
      if (parsed && parsed.sources && parsed.sources.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read existing datasources.json, repairing:', e.message);
    }
  }

  // Legacy data migration:
  const defaultDir = path.join(datasourcesDir, 'default');
  ensureDataSourceDirs(defaultDir);

  const legacyDb = path.join(baseDataDir, 'data.db');
  const targetDb = path.join(defaultDir, 'data.db');

  if (fs.existsSync(legacyDb) && !fs.existsSync(targetDb)) {
    try {
      console.log('Migrating legacy data.db to default datasource...');
      fs.copyFileSync(legacyDb, targetDb);
      // Also migrate WAL / SHM files if present
      if (fs.existsSync(legacyDb + '-wal')) fs.copyFileSync(legacyDb + '-wal', targetDb + '-wal');
      if (fs.existsSync(legacyDb + '-shm')) fs.copyFileSync(legacyDb + '-shm', targetDb + '-shm');
    } catch (err) {
      console.error('Error copying legacy data.db:', err);
    }
  }

  const legacyAssets = path.join(baseDataDir, 'assets');
  const targetAssets = path.join(defaultDir, 'assets');

  if (fs.existsSync(legacyAssets) && legacyAssets !== targetAssets) {
    try {
      console.log('Migrating legacy assets to default datasource...');
      for (const sub of ['snapshots', 'diffs', 'thumbnails']) {
        const srcSub = path.join(legacyAssets, sub);
        const dstSub = path.join(targetAssets, sub);
        if (fs.existsSync(srcSub)) {
          const files = fs.readdirSync(srcSub);
          for (const f of files) {
            const srcFile = path.join(srcSub, f);
            const dstFile = path.join(dstSub, f);
            if (!fs.existsSync(dstFile)) {
              fs.copyFileSync(srcFile, dstFile);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error copying legacy assets:', err);
    }
  }

  const initialRegistry = {
    activeId: 'default',
    sources: [
      {
        id: 'default',
        name: 'Default Workspace',
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      }
    ]
  };

  fs.writeFileSync(registryFile, JSON.stringify(initialRegistry, null, 2), 'utf8');
  return initialRegistry;
}

function getRegistry() {
  if (!fs.existsSync(registryFile)) {
    return initializeRegistry();
  }
  try {
    return JSON.parse(fs.readFileSync(registryFile, 'utf8'));
  } catch (e) {
    return initializeRegistry();
  }
}

function saveRegistry(reg) {
  fs.writeFileSync(registryFile, JSON.stringify(reg, null, 2), 'utf8');
}

/**
 * Returns active DataSource paths and metadata
 */
function getActiveDataSource() {
  const reg = getRegistry();
  let active = reg.sources.find((s) => s.id === reg.activeId);
  if (!active && reg.sources.length > 0) {
    active = reg.sources[0];
    reg.activeId = active.id;
    saveRegistry(reg);
  }
  if (!active) {
    // If empty, initialize
    const fresh = initializeRegistry();
    active = fresh.sources[0];
  }

  const paths = ensureDataSourceDirs(path.join(datasourcesDir, active.id));
  return {
    ...active,
    ...paths
  };
}

/**
 * Lists all DataSources with metadata and size statistics
 */
function listDataSources() {
  const reg = getRegistry();
  return reg.sources.map((src) => {
    const dsDir = path.join(datasourcesDir, src.id);
    const dbPath = path.join(dsDir, 'data.db');
    let hasDb = fs.existsSync(dbPath);
    let sizeBytes = 0;

    try {
      if (hasDb) {
        sizeBytes += fs.statSync(dbPath).size;
      }
      const assetsDir = path.join(dsDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        for (const sub of ['snapshots', 'diffs', 'thumbnails']) {
          const subDir = path.join(assetsDir, sub);
          if (fs.existsSync(subDir)) {
            const files = fs.readdirSync(subDir);
            for (const f of files) {
              sizeBytes += fs.statSync(path.join(subDir, f)).size;
            }
          }
        }
      }
    } catch (e) {
      // ignore stat errors
    }

    return {
      id: src.id,
      name: src.name,
      createdAt: src.createdAt,
      lastUsedAt: src.lastUsedAt,
      isActive: src.id === reg.activeId,
      sizeBytes
    };
  });
}

/**
 * Switches the active DataSource and notifies the repository
 */
function switchDataSource(id) {
  const reg = getRegistry();
  const target = reg.sources.find((s) => s.id === id);
  if (!target) {
    throw new Error(`DataSource "${id}" not found.`);
  }

  reg.activeId = target.id;
  target.lastUsedAt = new Date().toISOString();
  saveRegistry(reg);

  const activePaths = ensureDataSourceDirs(path.join(datasourcesDir, target.id));

  if (onDatabaseSwitchCallback) {
    onDatabaseSwitchCallback(activePaths.dbPath);
  }

  return {
    ...target,
    ...activePaths,
    isActive: true
  };
}

/**
 * Creates a brand new empty DataSource
 */
function createDataSource(name) {
  const cleanName = String(name || '').trim() || 'New Workspace';
  const id = 'ds_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
  const dsDir = path.join(datasourcesDir, id);
  const paths = ensureDataSourceDirs(dsDir);

  const reg = getRegistry();
  const newEntry = {
    id,
    name: cleanName,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString()
  };

  reg.sources.push(newEntry);
  saveRegistry(reg);

  // Switch to the newly created DataSource
  return switchDataSource(id);
}

/**
 * Renames an existing DataSource
 */
function renameDataSource(id, newName) {
  const cleanName = String(newName || '').trim();
  if (!cleanName) throw new Error('DataSource name cannot be empty.');

  const reg = getRegistry();
  const target = reg.sources.find((s) => s.id === id);
  if (!target) throw new Error(`DataSource "${id}" not found.`);

  target.name = cleanName;
  saveRegistry(reg);
  return target;
}

/**
 * Deletes a DataSource and all its assets
 */
function deleteDataSource(id) {
  const reg = getRegistry();
  if (reg.sources.length <= 1) {
    throw new Error('Cannot delete the last remaining DataSource.');
  }

  const targetIndex = reg.sources.findIndex((s) => s.id === id);
  if (targetIndex === -1) {
    throw new Error(`DataSource "${id}" not found.`);
  }

  const wasActive = reg.activeId === id;
  reg.sources.splice(targetIndex, 1);

  if (wasActive) {
    // Switch to first available
    reg.activeId = reg.sources[0].id;
  }
  saveRegistry(reg);

  const dsDir = path.join(datasourcesDir, id);
  try {
    if (fs.existsSync(dsDir)) {
      fs.rmSync(dsDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Error removing DataSource directory:', err);
  }

  if (wasActive) {
    switchDataSource(reg.activeId);
  }

  return { success: true, activeId: reg.activeId };
}

/**
 * Exports a DataSource as a .zip buffer containing data.db, assets, and manifest
 */
function exportDataSourceZip(id) {
  const reg = getRegistry();
  const target = reg.sources.find((s) => s.id === id) || getActiveDataSource();
  const dsDir = path.join(datasourcesDir, target.id);
  const dbPath = path.join(dsDir, 'data.db');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file for DataSource "${target.name}" not found.`);
  }

  const zip = new AdmZip();

  // Add manifest
  const manifest = {
    formatVersion: '1.0.0',
    app: 'Figma Changes Detector',
    id: target.id,
    name: target.name,
    exportedAt: new Date().toISOString()
  };
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

  // Add data.db
  zip.addLocalFile(dbPath, '', 'data.db');

  // Add assets if present
  const assetsDir = path.join(dsDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    zip.addLocalFolder(assetsDir, 'assets');
  }

  return {
    filename: `${target.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.zip`,
    buffer: zip.toBuffer()
  };
}

/**
 * Imports a DataSource from a .zip buffer
 */
function importDataSourceZip(fileBuffer, originalName = 'Imported Workspace') {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Provided zip file is empty.');
  }

  const zip = new AdmZip(fileBuffer);
  const entries = zip.getEntries();

  // Validate that zip contains data.db or manifest
  const hasDb = entries.some((e) => e.entryName === 'data.db' || e.entryName.endsWith('/data.db'));
  if (!hasDb) {
    throw new Error('Invalid workspace archive: "data.db" is missing.');
  }

  let importedName = originalName.replace(/\.zip$/i, '');
  const manifestEntry = entries.find((e) => e.entryName === 'manifest.json');
  if (manifestEntry) {
    try {
      const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
      if (manifest.name) {
        importedName = manifest.name;
      }
    } catch (e) {
      // ignore manifest parse error
    }
  }

  const id = 'ds_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
  const dsDir = path.join(datasourcesDir, id);
  ensureDataSourceDirs(dsDir);

  // Extract safely preventing path traversal
  for (const entry of entries) {
    const entryName = entry.entryName.replace(/\\/g, '/');
    if (entryName.includes('..')) continue; // Skip suspicious paths

    if (entry.isDirectory) {
      continue;
    }

    let targetRelPath = entryName;
    // Normalize root-level data.db
    if (entryName.endsWith('data.db')) {
      targetRelPath = 'data.db';
    }

    const fullDest = path.join(dsDir, targetRelPath);
    fs.mkdirSync(path.dirname(fullDest), { recursive: true });
    fs.writeFileSync(fullDest, entry.getData());
  }

  // Validate SQLite header
  const importedDbPath = path.join(dsDir, 'data.db');
  if (!fs.existsSync(importedDbPath)) {
    throw new Error('Failed to extract data.db from archive.');
  }

  const header = Buffer.alloc(16);
  const fd = fs.openSync(importedDbPath, 'r');
  fs.readSync(fd, header, 0, 16, 0);
  fs.closeSync(fd);

  if (header.toString('utf8').slice(0, 15) !== 'SQLite format 3') {
    fs.rmSync(dsDir, { recursive: true, force: true });
    throw new Error('Uploaded file is not a valid SQLite database archive.');
  }

  // Register in registry
  const reg = getRegistry();
  // Ensure unique name
  let finalName = importedName;
  let counter = 1;
  while (reg.sources.some((s) => s.name.toLowerCase() === finalName.toLowerCase())) {
    finalName = `${importedName} (${counter++})`;
  }

  const newSource = {
    id,
    name: finalName,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString()
  };

  reg.sources.push(newSource);
  saveRegistry(reg);

  // Activate the newly imported DataSource
  return switchDataSource(id);
}

// Initialize on module load
initializeRegistry();

module.exports = {
  datasourcesDir,
  initializeRegistry,
  getRegistry,
  getActiveDataSource,
  listDataSources,
  switchDataSource,
  createDataSource,
  renameDataSource,
  deleteDataSource,
  exportDataSourceZip,
  importDataSourceZip,
  setOnDatabaseSwitch
};
