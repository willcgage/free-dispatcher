/**
 * Free Dispatcher — Electron host shell (#32).
 *
 * Turns the Next.js standalone server into a double-click host app: no npm, no
 * terminal. The main process owns the lifecycle:
 *   1. resolve a writable per-user data dir + a persisted token secret,
 *   2. fork the bundled standalone server (Electron's own Node — no external
 *      runtime) bound to the LAN, which auto-migrates the DB on boot,
 *   3. wait until it answers, then open a small control-panel window showing
 *      the join URL + QR so operators can connect from their phones.
 *
 * The dispatch UI itself runs in the browser (host + operators); this window is
 * just the host console.
 */
const { app, BrowserWindow, ipcMain, shell, utilityProcess } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");

const PORT = Number(process.env.FD_PORT) || 3000;
const HOST_BIND = "0.0.0.0"; // listen on all interfaces so LAN phones can join
const LOOPBACK = `http://127.0.0.1:${PORT}`;

let serverProcess = null;
let win = null;

/** Standalone server dir — `next build` output, shipped in the package. */
function standaloneDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(__dirname, "..", ".next", "standalone");
}

/** A stable random token secret, generated once and persisted in userData. */
function tokenSecret() {
  const file = path.join(app.getPath("userData"), "token-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    const secret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

function startServer() {
  const dir = standaloneDir();
  const serverJs = path.join(dir, "server.js");
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  // cwd MUST be the standalone dir so the boot migrator resolves its bundled
  // migrations folder (lib/db/migrations) via process.cwd().
  serverProcess = utilityProcess.fork(serverJs, [], {
    cwd: dir,
    stdio: "inherit",
    env: {
      ...process.env,
      SERVER_MODE: "true",
      PORT: String(PORT),
      HOSTNAME: HOST_BIND,
      FD_DB_DIR: dataDir,
      FD_TOKEN_SECRET: tokenSecret(),
      NODE_ENV: "production",
    },
  });
}

/** Resolve once the server answers (it migrates the DB on first boot). */
function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`${LOOPBACK}/api/server-info`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() > deadline) return reject(new Error("server did not start in time"));
      setTimeout(tick, 500);
    };
    tick();
  });
}

/** Proxy the server's /api/server-info to the renderer (avoids file:// CORS). */
function fetchServerInfo() {
  return new Promise((resolve, reject) => {
    http
      .get(`${LOOPBACK}/api/server-info`, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 640,
    resizable: false,
    title: "Free Dispatcher — Host",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, "control-panel.html"));
}

ipcMain.handle("get-info", () => fetchServerInfo());
ipcMain.on("open-admin", () => shell.openExternal(`${LOOPBACK}/admin`));
ipcMain.on("open-url", (_e, url) => shell.openExternal(url));

app.whenReady().then(async () => {
  startServer();
  try {
    await waitForServer();
  } catch (err) {
    console.error("[freedispatcher] server failed to start:", err);
  }
  createWindow();
});

function shutdown() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.on("window-all-closed", () => {
  shutdown();
  app.quit();
});
app.on("before-quit", shutdown);
