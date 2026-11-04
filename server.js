const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const componentRoutes = require('./src/routes/componentRoutes');
const figmaRoutes = require('./src/routes/figmaRoutes');
const { compareWithPreviousFetch } = require('./src/services/diffService');

// Accommodate enterprise SSL inspection / corporate proxies if not explicitly configured
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure asset directories exist
const assetsDir = path.join(__dirname, 'assets');
const snapshotsDir = path.join(assetsDir, 'snapshots');
const diffsDir = path.join(assetsDir, 'diffs');
fs.mkdirSync(snapshotsDir, { recursive: true });
fs.mkdirSync(diffsDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(assetsDir));

// Mount modular feature routes
app.use('/api/components', componentRoutes);
app.use('/api', figmaRoutes);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Figma Changes Detector running at http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  compareWithPreviousFetch
};
