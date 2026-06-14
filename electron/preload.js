/**
 * Preload — the only bridge between the control-panel renderer and the main
 * process. No Node access in the renderer; just these three calls.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fd", {
  /** Latest server info: { ip, port, url, qrDataUrl, serverMode }. */
  getInfo: () => ipcRenderer.invoke("get-info"),
  /** Open the Admin console in the user's default browser. */
  openAdmin: () => ipcRenderer.send("open-admin"),
  /** Open an arbitrary URL (the join URL) in the default browser. */
  openUrl: (url) => ipcRenderer.send("open-url", url),
});
