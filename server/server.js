const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
// Load environment variables from server/ or project root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { assetsDir, getActiveAssetsDir } = require('./src/config/paths');
const componentRoutes = require('./src/routes/componentRoutes');
const figmaRoutes = require('./src/routes/figmaRoutes');
const collabRoutes = require('./src/routes/collabRoutes');
const dataSourceRoutes = require('./src/routes/dataSourceRoutes');
const { compareWithPreviousFetch } = require('./src/services/diffService');

// Accommodate enterprise SSL inspection / corporate proxies if not explicitly configured
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Assets dynamic static serving per active DataSource
app.use('/assets', (req, res, next) => {
  express.static(getActiveAssetsDir())(req, res, next);
});

// Mount modular feature routes
app.use('/api/datasources', dataSourceRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/collab', collabRoutes);
app.use('/api', figmaRoutes);

// Frontend static serving: serve client/dist when built, fallback to server/public/
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/assets')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/assets')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

function startServer(port = PORT, host = process.env.HOST) {
  return new Promise((resolve, reject) => {
    const onListening = () => {
      const displayHost = host || 'localhost';
      console.log(`Figma Changes Detector running at:`);
      console.log(`  - Local:    http://${displayHost}:${port}`);
      if (!host || host === '0.0.0.0') {
        console.log(`  - Loopback: http://127.0.0.1:${port}`);
      }
      resolve(server);
    };

    const server = (host ? app.listen(port, host, onListening) : app.listen(port, onListening))
      .on('error', reject);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
  compareWithPreviousFetch
};
