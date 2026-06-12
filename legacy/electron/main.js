// Electron main process entry.
// Boots the FastAPI backend (uvicorn) on a dynamic local port, then loads the React renderer.

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import url from 'node:url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const isDev = process.env.ELECTRON_DEV === '1';
let backendProcess = null;
let backendUrl = null;

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function startBackend() {
  if (backendProcess) return backendUrl;
  const port = await findOpenPort();
  const backendDir = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'backend');
  const userDataDir = app.getPath('userData');
  const sqlitePath = path.join(userDataDir, 'dispatcher.db');
  const env = {
    ...process.env,
    BACKEND_PORT: port,
    USER_DATA_DIR: userDataDir,
    DATABASE_URL: process.env.DATABASE_URL || `sqlite+aiosqlite:///${sqlitePath}`,
  };

  // In dev, use system Python; in packaged, run the bundled binary.
  if (app.isPackaged) {
    const binName = process.platform === 'win32' ? 'backend-app.exe' : 'backend-app';
    const binPath = path.join(backendDir, binName);
    backendProcess = spawn(binPath, [], {
      env,
      stdio: 'inherit',
    });
  } else {
    const pythonCmd = process.env.PYTHON || 'python3';
    backendProcess = spawn(
      pythonCmd,
      ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(port)],
      {
        cwd: backendDir,
        env,
        stdio: 'inherit',
      }
    );
  }

  backendProcess.on('exit', (code, signal) => {
    console.error(`Backend exited: code=${code} signal=${signal}`);
    backendProcess = null;
    backendUrl = null;
    if (!app.isQuitting) {
      app.quit();
    }
  });

  backendUrl = `http://127.0.0.1:${port}`;
  return backendUrl;
}

async function createWindow() {
  await startBackend();
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    await win.loadFile(indexPath);
  }
}

ipcMain.handle('get-backend-url', async () => {
  if (!backendUrl) await startBackend();
  return backendUrl;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
