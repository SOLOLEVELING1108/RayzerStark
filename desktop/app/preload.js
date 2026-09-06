const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  setSteamPath: (p) => ipcRenderer.invoke("set-steam-path", p),
  checkSteamPath: () => ipcRenderer.invoke("check-steam-path"),
  getStatus: () => ipcRenderer.invoke("get-status"),
  activateGame: (game) => ipcRenderer.invoke("activate-game", game),
  deactivateGame: (gameId) => ipcRenderer.invoke("deactivate-game", gameId),
  installDependencies: () => ipcRenderer.invoke("install-dependencies"),
  deleteAll: () => ipcRenderer.invoke("delete-all"),
  downloadBypass: (bypass) => ipcRenderer.invoke("download-bypass", bypass),
  getKey: () => ipcRenderer.invoke("get-key"),
  setKey: (k) => ipcRenderer.invoke("set-key", k),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  onProgress: (cb) => ipcRenderer.on("inject-progress", (_e, d) => cb(d)),
  onDepProgress: (cb) => ipcRenderer.on("dep-progress", (_e, d) => cb(d)),
  checkNativeUpdate: () => ipcRenderer.invoke("check-native-update"),
});
