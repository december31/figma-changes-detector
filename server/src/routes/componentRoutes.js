const express = require('express');
const router = express.Router();
const {
  getAllComponentsWithStatus,
  getComponentById,
  upsertComponent,
  updateComponent,
  deleteComponent,
  getComponentHistory,
  getAllFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  resolveSemiRootFolder,
  parseFigmaUrl
} = require('../repositories/componentRepository');
const { executeComponentFetch, normalizeNodeId } = require('../services/figmaService');

// GET /api/components - List all watched components
router.get('/', (req, res) => {
  try {
    const components = getAllComponentsWithStatus();
    res.json({ success: true, components });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/components/folders - List all folders
router.get('/folders', (req, res) => {
  try {
    const folders = getAllFolders();
    res.json({ success: true, folders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/components/folders - Create folder
router.post('/folders', (req, res) => {
  try {
    const { path } = req.body || {};
    const result = createFolder(path);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/components/folders - Rename folder
router.put('/folders', (req, res) => {
  try {
    const { oldPath, newPath } = req.body || {};
    const result = renameFolder(oldPath, newPath);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/components/folders - Delete folder
router.delete('/folders', (req, res) => {
  try {
    const { path, deleteComponents } = req.body || {};
    const result = deleteFolder(path, Boolean(deleteComponents));
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/components - Add component (or fetch immediately)
router.post('/', async (req, res) => {
  try {
    const { name, fileKey, fileName, nodeId, format = 'png', scale = 2, figmaUrl = '', fetchNow = false, token, folderPath = '' } = req.body;
    if (!fileKey || !fileKey.trim() || !nodeId || !String(nodeId).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Both File Key and Node ID are required to add a component.'
      });
    }

    const cleanFileKey = fileKey.trim();
    const cleanNodeId = normalizeNodeId(nodeId);

    if (fetchNow) {
      const activeToken = (token && token.trim()) || (process.env.FIGMA_ACCESS_TOKEN && process.env.FIGMA_ACCESS_TOKEN.trim());
      if (!activeToken) {
        return res.status(400).json({
          success: false,
          error: 'Figma Access Token is required to fetch immediately.'
        });
      }
      const result = await executeComponentFetch({
        token: activeToken,
        fileKey: cleanFileKey,
        fileName: fileName ? fileName.trim() : undefined,
        nodeId: cleanNodeId,
        format,
        scale,
        customName: name ? name.trim() : '',
        figmaUrl,
        folderPath
      });
      return res.json({ success: true, ...result });
    }

    const parsedFromUrl = figmaUrl ? parseFigmaUrl(figmaUrl) : null;
    const fileTitle = (fileName && fileName.trim()) || (parsedFromUrl && parsedFromUrl.fileName) || null;
    const resolvedFolder = fileTitle
      ? resolveSemiRootFolder(fileTitle, getAllFolders(), folderPath)
      : folderPath;

    const component = upsertComponent({
      name: (name && name.trim()) || `Component ${cleanNodeId}`,
      fileKey: cleanFileKey,
      fileName: fileTitle || 'Figma Document',
      nodeId: cleanNodeId,
      format,
      scale,
      figmaUrl,
      folderPath: resolvedFolder
    });

    return res.json({ success: true, component });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// PUT /api/components/:id - Update component details
router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = getComponentById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Component not found in watchlist.' });
    }

    const { name, fileKey, fileName, nodeId, format, scale, figmaUrl, folderPath } = req.body || {};
    if (fileKey !== undefined && !String(fileKey).trim()) {
      return res.status(400).json({ success: false, error: 'File Key cannot be empty.' });
    }
    if (nodeId !== undefined && !String(nodeId).trim()) {
      return res.status(400).json({ success: false, error: 'Node ID cannot be empty.' });
    }

    const validFormat = format
      ? (['png', 'jpg', 'svg', 'pdf'].includes(String(format).toLowerCase()) ? String(format).toLowerCase() : 'png')
      : undefined;
    const validScale = scale !== undefined
      ? Math.min(Math.max(Number(scale) || 2, 0.01), 4)
      : undefined;

    const updated = updateComponent(id, {
      name: name !== undefined ? String(name).trim() : undefined,
      fileKey: fileKey !== undefined ? String(fileKey).trim() : undefined,
      fileName: fileName !== undefined ? String(fileName).trim() : undefined,
      nodeId: nodeId !== undefined ? normalizeNodeId(nodeId) : undefined,
      format: validFormat,
      scale: validScale,
      figmaUrl: figmaUrl !== undefined ? String(figmaUrl).trim() : undefined,
      folderPath: folderPath !== undefined ? String(folderPath).trim() : undefined
    });

    return res.json({ success: true, component: updated });
  } catch (err) {
    const statusCode = err.code === 'SQLITE_CONSTRAINT' ? 409 : 500;
    return res.status(statusCode).json({ success: false, error: err.message });
  }
});

// DELETE /api/components/:id - Delete component & snapshots
router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    deleteComponent(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/components/:id/history - Component fetch history
router.get('/:id/history', (req, res) => {
  try {
    const id = Number(req.params.id);
    const component = getComponentById(id);
    if (!component) {
      return res.status(404).json({ success: false, error: 'Component not found.' });
    }
    const history = getComponentHistory(id, 50);
    res.json({ success: true, component, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/components/:id/fetch - Fetch single component
router.post('/:id/fetch', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const component = getComponentById(id);
    if (!component) {
      return res.status(404).json({ success: false, error: 'Component not found in watchlist.' });
    }

    const { token } = req.body || {};
    const activeToken = (token && token.trim()) || (process.env.FIGMA_ACCESS_TOKEN && process.env.FIGMA_ACCESS_TOKEN.trim());
    if (!activeToken) {
      return res.status(400).json({
        success: false,
        error: 'Figma Access Token is required. Provide it in the UI or set FIGMA_ACCESS_TOKEN in .env'
      });
    }

    const result = await executeComponentFetch({
      token: activeToken,
      fileKey: component.file_key,
      nodeId: component.node_id,
      format: component.format || 'png',
      scale: component.scale || 2,
      customName: component.name,
      figmaUrl: component.figma_url
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// POST /api/components/fetch-all - Batch check all components
router.post('/fetch-all', async (req, res) => {
  try {
    const { token } = req.body || {};
    const activeToken = (token && token.trim()) || (process.env.FIGMA_ACCESS_TOKEN && process.env.FIGMA_ACCESS_TOKEN.trim());
    if (!activeToken) {
      return res.status(400).json({
        success: false,
        error: 'Figma Access Token is required. Provide it in the UI or set FIGMA_ACCESS_TOKEN in .env'
      });
    }

    const components = getAllComponentsWithStatus();
    if (!components.length) {
      return res.status(400).json({
        success: false,
        error: 'No components in watchlist yet. Add at least one component first.'
      });
    }

    const results = [];
    let changedCount = 0;
    let unchangedCount = 0;
    let baselineCount = 0;
    let errorCount = 0;

    for (const comp of components) {
      try {
        const resItem = await executeComponentFetch({
          token: activeToken,
          fileKey: comp.file_key,
          nodeId: comp.node_id,
          format: comp.format || 'png',
          scale: comp.scale || 2,
          customName: comp.name,
          figmaUrl: comp.figma_url
        });

        const status = resItem.currentFetch.change_status;
        if (status === 'changed') changedCount++;
        else if (status === 'unchanged') unchangedCount++;
        else baselineCount++;

        results.push({
          componentId: comp.id,
          success: true,
          ...resItem
        });
      } catch (err) {
        errorCount++;
        results.push({
          componentId: comp.id,
          name: comp.name,
          nodeId: comp.node_id,
          success: false,
          error: err.message
        });
      }
    }

    return res.json({
      success: true,
      summary: {
        total: components.length,
        changed: changedCount,
        unchanged: unchangedCount,
        baseline: baselineCount,
        errors: errorCount
      },
      results
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
