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
 * just the host console. All server output + lifecycle is written to
 * userData/logs/host.log so failures in a packaged build are diagnosable.
 */
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell, utilityProcess } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");

const PORT = Number(process.env.FD_PORT) || 3000;
const HOST_BIND = "0.0.0.0"; // listen on all interfaces so LAN phones can join
const LOOPBACK = `http://127.0.0.1:${PORT}`;
const MAX_RESTARTS = 1;

let serverProcess = null;
let win = null;
let tray = null;
let quitting = false;
let restarts = 0;
let lastServerError = "";

function logPath() {
  return path.join(app.getPath("userData"), "logs", "host.log");
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.mkdirSync(path.dirname(logPath()), { recursive: true });
    fs.appendFileSync(logPath(), line);
  } catch {
    /* logging is best-effort */
  }
}

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

function notifyStatus(status) {
  win?.webContents?.send("server-status", status);
}

function startServer() {
  const dir = standaloneDir();
  const serverJs = path.join(dir, "server.js");
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(serverJs)) {
    log(`FATAL: server bundle missing at ${serverJs}`);
    notifyStatus({ state: "crashed", detail: `server bundle missing: ${serverJs}` });
    return;
  }

  log(`starting server: ${serverJs} (cwd=${dir}, data=${dataDir}, port=${PORT})`);

  // cwd MUST be the standalone dir so the boot migrator resolves its bundled
  // migrations folder (lib/db/migrations) via process.cwd(). stdio "pipe" (not
  // "inherit") — a packaged Windows GUI app has no valid console to inherit, and
  // we want the output in the log file.
  serverProcess = utilityProcess.fork(serverJs, [], {
    cwd: dir,
    stdio: "pipe",
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

  serverProcess.stdout?.on("data", (d) => log(`[server] ${d.toString().trimEnd()}`));
  serverProcess.stderr?.on("data", (d) => {
    const s = d.toString().trimEnd();
    lastServerError = s;
    log(`[server:err] ${s}`);
  });
  serverProcess.on("spawn", () => log("server process spawned"));
  serverProcess.on("exit", (code) => {
    serverProcess = null;
    log(`server exited code=${code} quitting=${quitting} restarts=${restarts}`);
    if (quitting) return;
    if (restarts < MAX_RESTARTS) {
      restarts += 1;
      log("server exited unexpectedly — restarting once");
      notifyStatus({ state: "restarting" });
      setTimeout(startServer, 500);
    } else {
      notifyStatus({ state: "crashed", code, detail: lastServerError });
    }
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
function fetchServerInfo(host) {
  const q = host ? `?host=${encodeURIComponent(host)}` : "";
  return new Promise((resolve, reject) => {
    http
      .get(`${LOOPBACK}/api/server-info${q}`, (res) => {
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

  // Closing the window hides it to the tray and keeps the server running —
  // operators rely on it via the browser. Quit only via the tray menu.
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  else {
    win.show();
    win.focus();
  }
}

function createTray() {
  const icon = nativeImage
    .createFromPath(path.join(__dirname, "tray-icon.png"))
    .resize({ width: 32, height: 32 });
  tray = new Tray(icon);
  tray.setToolTip("Free Dispatcher — host");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show host window", click: showWindow },
      { label: "Open Admin console", click: () => shell.openExternal(`${LOOPBACK}/admin`) },
      { type: "separator" },
      {
        label: "Quit Free Dispatcher",
        click: () => {
          quitting = true;
          shutdown();
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showWindow);
}

ipcMain.handle("get-info", (_e, host) => fetchServerInfo(host));
ipcMain.handle("log-path", () => logPath());
ipcMain.on("open-admin", () => shell.openExternal(`${LOOPBACK}/admin`));
ipcMain.on("open-url", (_e, url) => shell.openExternal(url));
ipcMain.on("open-logs", () => shell.showItemInFolder(logPath()));

app.whenReady().then(async () => {
  log(`app ready — packaged=${app.isPackaged} userData=${app.getPath("userData")}`);
  createTray();
  startServer();
  try {
    await waitForServer();
    log("server is ready");
  } catch (err) {
    log(`server did not become ready: ${err && err.message}`);
    notifyStatus({ state: "crashed", detail: lastServerError || String(err && err.message) });
  }
  createWindow();
});

function shutdown() {
  quitting = true;
  if (serverProcess) {
    log("shutting down server");
    serverProcess.kill();
    serverProcess = null;
  }
}

// Don't quit when the window is closed — the server keeps running in the tray.
// Quit happens only via the tray "Quit" item (or before-quit).
app.on("window-all-closed", () => {
  log("window hidden to tray — server still running");
});
app.on("before-quit", () => {
  quitting = true;
  shutdown();
});
