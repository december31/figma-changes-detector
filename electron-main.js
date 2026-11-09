const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

let mainWindow = null;
let serverInstance = null;
let logFilePath = null;

// Helper to log errors to disk so they can be inspected on Windows
function logError(title, err) {
  const errMsg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
  console.error(`[${title}]`, errMsg);
  try {
    if (!logFilePath && app.isReady()) {
      logFilePath = path.join(app.getPath('userData'), 'crash.log');
    }
    if (logFilePath) {
      fs.appendFileSync(logFilePath, `\n[${new Date().toISOString()}] [${title}] ${errMsg}\n`);
    }
  } catch (e) {
    // Ignore logging write errors
  }
}

// Global crash handlers - on Windows, show a native message box instead of silently hanging
process.on('uncaughtException', (err) => {
  logError('UNCAUGHT_EXCEPTION', err);
  dialog.showErrorBox('Figma Changes Detector - Unexpected Error', err.stack || err.message || String(err));
});

process.on('unhandledRejection', (err) => {
  logError('UNHANDLED_REJECTION', err);
  dialog.showErrorBox('Figma Changes Detector - Unhandled Rejection', String(err));
});

// Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function getAvailablePort(desiredPort = 3000) {
  return new Promise((resolve) => {
    const testServer = net.createServer();
    testServer.once('error', () => {
      // Fallback to random free port on loopback
      const fallbackServer = net.createServer();
      fallbackServer.listen(0, '127.0.0.1', () => {
        const port = fallbackServer.address().port;
        fallbackServer.close(() => resolve(port));
      });
    });
    // Bind explicitly to 127.0.0.1 to avoid Windows Firewall prompts
    testServer.listen(desiredPort, '127.0.0.1', () => {
      const port = testServer.address().port;
      testServer.close(() => resolve(port));
    });
  });
}

async function createWindow() {
  try {
    // 1. Initialize user data directory AFTER app is ready
    const userData = app.getPath('userData');
    logFilePath = path.join(userData, 'crash.log');
    const userDataDir = path.join(userData, 'data');
    fs.mkdirSync(userDataDir, { recursive: true });
    process.env.APP_DATA_DIR = userDataDir;

    // Load .env if present in userData
    const userEnvPath = path.join(userData, '.env');
    if (fs.existsSync(userEnvPath)) {
      require('dotenv').config({ path: userEnvPath });
    }

    // 2. Create Window immediately so Windows taskbar & UI respond without delay
    mainWindow = new BrowserWindow({
      width: 1360,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      title: 'Figma Changes Detector',
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    mainWindow.removeMenu();

    // Show initial loading state while server boots
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Figma Changes Detector</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; flex-direction: column; }
            .spinner { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #1abcfe; border-radius: 50%; width: 36px; height: 36px; animation: spin 0.8s linear infinite; margin-bottom: 16px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <div style="font-size: 15px; font-weight: 500;">Starting Figma Changes Detector...</div>
        </body>
      </html>
    `)}`);

    // Intercept external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http:') || url.startsWith('https:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    // 3. Start Express server in try-catch
    const port = await getAvailablePort(3000);
    const { startServer } = require('./server/server.js');
    serverInstance = await startServer(port);

    // 4. Load the app URL
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    logError('STARTUP_ERROR', err);
    if (mainWindow) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
          <head><title>Startup Error</title></head>
          <body style="font-family: sans-serif; padding: 2rem; background: #fee2e2; color: #991b1b;">
            <h2>Startup Error</h2>
            <pre style="white-space: pre-wrap; font-size: 13px;">${err.stack || err.message || String(err)}</pre>
            <p>Error log saved to: <code>%APPDATA%\\Figma Changes Detector\\crash.log</code></p>
          </body>
        </html>
      `)}`);
    }
    dialog.showErrorBox('Startup Error', `Figma Changes Detector failed to start:\n\n${err.stack || err.message}`);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverInstance && serverInstance.close) {
    try {
      serverInstance.close();
    } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
