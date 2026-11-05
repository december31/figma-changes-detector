const express = require('express');
const router = express.Router();
const { executeComponentFetch } = require('../services/figmaService');

// GET /api/config - App runtime configuration (token presence check)
router.get('/config', (req, res) => {
  res.json({
    hasDefaultToken: Boolean(process.env.FIGMA_ACCESS_TOKEN && process.env.FIGMA_ACCESS_TOKEN.trim())
  });
});

// POST /api/figma/image - Direct fetch endpoint
router.post('/figma/image', async (req, res) => {
  try {
    const { token, fileKey, nodeId, format = 'png', scale = 2, name = '', figmaUrl = '', folderPath = '' } = req.body;

    const activeToken = (token && token.trim()) || (process.env.FIGMA_ACCESS_TOKEN && process.env.FIGMA_ACCESS_TOKEN.trim());
    if (!activeToken) {
      return res.status(400).json({
        success: false,
        error: 'Figma Access Token is required. Please provide it in the web interface or configure FIGMA_ACCESS_TOKEN in .env'
      });
    }

    if (!fileKey || !fileKey.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Figma File Key is required.'
      });
    }

    if (!nodeId || !String(nodeId).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Figma Node / Component ID is required.'
      });
    }

    const result = await executeComponentFetch({
      token: activeToken,
      fileKey,
      nodeId,
      format,
      scale,
      customName: name ? name.trim() : '',
      figmaUrl,
      folderPath
    });

    return res.json({
      success: true,
      imageUrl: result.currentFetch.image_path,
      fileKey: result.component.file_key,
      nodeId: result.component.node_id,
      nodeName: result.component.name,
      nodeType: result.component.node_type,
      fileName: result.component.file_name,
      format: result.component.format,
      scale: result.component.scale,
      timestamp: result.currentFetch.fetched_at,
      component: result.component,
      currentFetch: result.currentFetch,
      previousFetch: result.previousFetch
    });
  } catch (err) {
    console.error('Error in /api/figma/image:', err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
});

module.exports = router;
