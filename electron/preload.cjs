const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
});