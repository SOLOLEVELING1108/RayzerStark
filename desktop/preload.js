const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  setSteamPath: (p) => ipcRenderer.invoke("set-steam-path", p),
  checkSteamPath: () => ipcRenderer.invoke("check-steam-path"),
  getActivations: () => ipcRenderer.invoke("get-activations"),
  activateGame: (game) => ipcRenderer.invoke("activate-game", game),
  deactivateGame: (gameId) => ipcRenderer.invoke("deactivate-game", gameId),
  onProgress: (cb) => ipcRenderer.on("inject-progress", (_e, data) => cb(data)),
});
