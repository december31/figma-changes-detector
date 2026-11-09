const express = require('express');
const router = express.Router();
const multer = require('multer');
const dataSourceManager = require('../services/dataSourceManager');
const { getTrackedComponents } = require('../repositories/componentRepository');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max zip upload
  }
});

// GET /api/datasources - List all datasources
router.get('/', (req, res) => {
  try {
    const list = dataSourceManager.listDataSources();
    // Add component count for current active datasource
    const active = list.find((s) => s.isActive);
    if (active) {
      try {
        const comps = getTrackedComponents();
        active.componentCount = Array.isArray(comps) ? comps.length : 0;
      } catch (e) {
        active.componentCount = 0;
      }
    }
    res.json({ success: true, datasources: list });
  } catch (err) {
    console.error('Error listing datasources:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/datasources - Create a new empty datasource
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    const created = dataSourceManager.createDataSource(name);
    res.status(201).json({ success: true, datasource: created });
  } catch (err) {
    console.error('Error creating datasource:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/datasources/:id/activate - Switch active datasource
router.post('/:id/activate', (req, res) => {
  try {
    const { id } = req.params;
    const activated = dataSourceManager.switchDataSource(id);
    res.json({ success: true, datasource: activated });
  } catch (err) {
    console.error('Error switching datasource:', err);
    res.status(404).json({ success: false, error: err.message });
  }
});

// PUT /api/datasources/:id - Rename datasource
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updated = dataSourceManager.renameDataSource(id, name);
    res.json({ success: true, datasource: updated });
  } catch (err) {
    console.error('Error renaming datasource:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/datasources/:id - Delete datasource
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = dataSourceManager.deleteDataSource(id);
    res.json(result);
  } catch (err) {
    console.error('Error deleting datasource:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/datasources/:id/export - Download datasource bundle as .zip
router.get('/:id/export', (req, res) => {
  try {
    const { id } = req.params;
    const { filename, buffer } = dataSourceManager.exportDataSourceZip(id);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting datasource zip:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/datasources/import - Upload and register a .zip bundle
router.post('/import', upload.single('bundle'), (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No zip file provided.' });
    }

    const originalName = req.file.originalname || 'Imported Workspace';
    const imported = dataSourceManager.importDataSourceZip(req.file.buffer, originalName);

    res.status(201).json({ success: true, datasource: imported });
  } catch (err) {
    console.error('Error importing datasource zip:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
