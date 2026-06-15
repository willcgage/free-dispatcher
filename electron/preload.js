/**
 * Preload — the only bridge between the control-panel renderer and the main
 * process. No Node access in the renderer; just these calls.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fd", {
  /** Latest server info: { ip, port, url, qrDataUrl, serverMode }. */
  getInfo: () => ipcRenderer.invoke("get-info"),
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
});
