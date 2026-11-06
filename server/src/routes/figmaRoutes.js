const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { executeComponentFetch } = require('../services/figmaService');
const { getOrCreateThumbnail, rootDir } = require('../services/thumbnailService');

// GET /api/config - App runtime configuration (token presence check)
router.get('/config', (req, res) => {
  res.json({
    hasDefaultToken: Boolean(process.env.FIGMA_ACCESS_TOKEN && process.env.FIGMA_ACCESS_TOKEN.trim())
  });
});

// GET /api/thumbnail?src=...&size=96 - Fast low-memory thumbnail endpoint
router.get('/thumbnail', async (req, res) => {
  try {
    const { src, size } = req.query;
    if (!src) return res.status(400).send('Missing src query param');

    const targetSize = Math.min(Math.max(parseInt(size, 10) || 96, 32), 256);
    const thumbPath = await getOrCreateThumbnail(src, targetSize);
    if (!thumbPath) return res.status(404).send('Image not found');

    const diskPath = path.join(rootDir, thumbPath.replace(/^\//, ''));
    if (fs.existsSync(diskPath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(diskPath);
    }
    return res.redirect(thumbPath);
  } catch (err) {
    console.error('Thumbnail route error:', err);
    return res.status(500).send('Error generating thumbnail');
  }
});

// POST /api/figma/image - Direct fetch endpoint
router.post('/figma/image', async (req, res) => {
  try {
    const { token, fileKey, fileName, nodeId, format = 'png', scale = 2, name = '', figmaUrl = '', folderPath = '' } = req.body;

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
      fileName: fileName ? fileName.trim() : undefined,
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
