const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

// Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Store application data in user profile directory (e.g. %APPDATA%/figma-changes-detector)
const userDataDir = path.join(app.getPath('userData'), 'data');
fs.mkdirSync(userDataDir, { recursive: true });
process.env.APP_DATA_DIR = userDataDir;

// Also look for .env in userDataDir, root, or server
const userEnvPath = path.join(app.getPath('userData'), '.env');
if (fs.existsSync(userEnvPath)) {
  require('dotenv').config({ path: userEnvPath });
}

let mainWindow = null;
let serverInstance = null;

function getAvailablePort(desiredPort = 3000) {
  return new Promise((resolve) => {
    const testServer = net.createServer();
    testServer.once('error', () => {
      // Fallback to random free port
      const fallbackServer = net.createServer();
      fallbackServer.listen(0, () => {
        const port = fallbackServer.address().port;
        fallbackServer.close(() => resolve(port));
      });
    });
    testServer.listen(desiredPort, () => {
      const port = testServer.address().port;
      testServer.close(() => resolve(port));
    });
  });
}

async function createWindow() {
  const port = await getAvailablePort(3000);

  // Start Express server
  const { startServer } = require('./server/server.js');
  serverInstance = await startServer(port);

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Figma Changes Detector',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.removeMenu(); // Clean desktop app UI

  // Open external links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverInstance && serverInstance.close) {
    serverInstance.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
