/**
 * Preload — the only bridge between the control-panel renderer and the main
 * process. No Node access in the renderer; just these calls.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fd", {
  /** Latest server info: { ip, port, url, qrDataUrl, serverMode, interfaces }.
   *  Pass an interface IP to point the url/QR at a specific address. */
  getInfo: (host) => ipcRenderer.invoke("get-info", host),
  /** Open the Admin console in the user's default browser. */
  openAdmin: () => ipcRenderer.send("open-admin"),
  /** Open an arbitrary URL (the join URL) in the default browser. */
  openUrl: (url) => ipcRenderer.send("open-url", url),
  /** Reveal the host log file in the OS file manager. */
  openLogs: () => ipcRenderer.send("open-logs"),
  /** Absolute path to the host log file. */
  logPath: () => ipcRenderer.invoke("log-path"),
  /** Subscribe to server lifecycle status: { state: 'restarting'|'crashed', ... }. */
  onStatus: (cb) => ipcRenderer.on("server-status", (_e, s) => cb(s)),

  // ---- Auto-update -------------------------------------------------------
  /** { version, beta, enabled } — current version + updater availability. */
  updaterState: () => ipcRenderer.invoke("updater-state"),
  /** Trigger a check now (results arrive via onUpdater). */
  updaterCheck: () => ipcRenderer.invoke("updater-check"),
  /** Download the available update (progress arrives via onUpdater). */
  updaterDownload: () => ipcRenderer.invoke("updater-download"),
  /** Quit and install a downloaded update. */
  updaterInstall: () => ipcRenderer.send("updater-install"),
  /** Toggle whether beta (pre-release) updates are offered; re-checks. */
  updaterSetBeta: (on) => ipcRenderer.invoke("updater-set-beta", on),
  /** Set the automatic-check interval in minutes (0 = off). Returns the applied value. */
  updaterSetInterval: (minutes) =>
    ipcRenderer.invoke("updater-set-interval", minutes),
  /** Subscribe to updater status:
   *  { state: 'checking'|'current'|'available'|'downloading'|'downloaded'|'error', ... }. */
  onUpdater: (cb) => ipcRenderer.on("updater", (_e, s) => cb(s)),
});
