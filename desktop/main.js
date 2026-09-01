const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const CONFIG_PATH = path.join(__dirname, "config.json");

function loadFileConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return { apiBase: "http://localhost:8001", steamPath: "C:\\Program Files (x86)\\Steam" };
  }
}

// User-writable store (activations + steam path override)
function storePath() {
  return path.join(app.getPath("userData"), "store.json");
}
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(storePath(), "utf-8"));
  } catch {
    return { steamPath: null, activations: {} };
  }
}
function saveStore(s) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(s, null, 2));
}

function getSteamPath() {
  const store = loadStore();
  return store.steamPath || loadFileConfig().steamPath;
}
function getApiBase() {
  return loadFileConfig().apiBase.replace(/\/$/, "");
}

function targetDir(token) {
  const steam = getSteamPath();
  if (token === "steam_config_lua") return path.join(steam, "config", "lua");
  return steam; // steam_root
}

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#08090E",
    autoHideMenuBar: true,
    title: "Steam Config Patcher",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---------- IPC ----------
ipcMain.handle("get-config", () => ({
  apiBase: getApiBase(),
  steamPath: getSteamPath(),
  activations: loadStore().activations || {},
}));

ipcMain.handle("set-steam-path", (_e, p) => {
  const store = loadStore();
  store.steamPath = p;
  saveStore(store);
  return getSteamPath();
});

ipcMain.handle("check-steam-path", () => {
  const p = getSteamPath();
  return { path: p, exists: fs.existsSync(p) };
});

async function downloadTo(url, dir, filename, event) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${filename}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, filename);
  fs.writeFileSync(dest, buf);
  return dest;
}

ipcMain.handle("activate-game", async (event, game) => {
  const api = getApiBase();
  const res = await fetch(`${api}/api/games/${game.id}/package`);
  if (!res.ok) throw new Error("Could not fetch injection package");
  const pkg = await res.json();

  if (!pkg.files || pkg.files.length === 0) {
    throw new Error("This game has no files attached on the server.");
  }

  const written = [];
  for (let i = 0; i < pkg.files.length; i++) {
    const f = pkg.files[i];
    event.sender.send("inject-progress", {
      gameId: game.id,
      current: i + 1,
      total: pkg.files.length,
      filename: f.filename,
      type: f.type,
    });
    const url = `${api}/api/files/download?path=${encodeURIComponent(f.download_path)}`;
    const dir = targetDir(f.target);
    const dest = await downloadTo(url, dir, f.filename, event);
    written.push({ path: dest, type: f.type, filename: f.filename });
  }

  const store = loadStore();
  store.activations = store.activations || {};
  store.activations[game.id] = {
    title: pkg.title,
    app_id: pkg.app_id,
    files: written,
    activatedAt: new Date().toISOString(),
  };
  saveStore(store);
  return { ok: true, files: written };
});

ipcMain.handle("deactivate-game", async (_e, gameId) => {
  const store = loadStore();
  const entry = (store.activations || {})[gameId];
  const removed = [];
  if (entry) {
    for (const f of entry.files) {
      try {
        if (fs.existsSync(f.path)) {
          fs.unlinkSync(f.path);
          removed.push(f.filename);
        }
      } catch (e) {
        // ignore individual delete errors
      }
    }
    delete store.activations[gameId];
    saveStore(store);
  }
  return { ok: true, removed };
});

ipcMain.handle("get-activations", () => loadStore().activations || {});
