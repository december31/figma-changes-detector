const express = require('express');
const router = express.Router();
const {
  getCollabConfig,
  verifyParentPage,
  publishReportToCollab
} = require('../services/collabService');

// GET /api/collab/config - Check Collab URL and default token status
router.get('/config', (req, res) => {
  try {
    const config = getCollabConfig();
    res.json({ success: true, ...config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/collab/verify-parent - Verify parent page and resolve target space
router.post('/verify-parent', async (req, res) => {
  try {
    const { parentPageId, collabUrl, token } = req.body || {};
    if (!parentPageId) {
      return res.status(400).json({ success: false, error: 'Parent Page ID is required.' });
    }

    const result = await verifyParentPage({ parentPageId, collabUrl, token });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/collab/publish-report - Publish run report to Collab
router.post('/publish-report', async (req, res) => {
  try {
    const { runId, parentPageId, pageTitle, collabUrl, token } = req.body || {};

    if (!runId) {
      return res.status(400).json({ success: false, error: 'Run ID is required.' });
    }
    if (!parentPageId) {
      return res.status(400).json({ success: false, error: 'Parent Page ID is required.' });
    }

    const result = await publishReportToCollab({
      runId,
      parentPageId,
      pageTitle,
      collabUrl,
      token
    });

    res.json(result);
  } catch (err) {
    console.error('Publish report error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
