const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
let machineIdSync = null;
try { machineIdSync = require("node-machine-id").machineIdSync; } catch { machineIdSync = null; }

const CONFIG_PATH = path.join(__dirname, "config.json");

function fileConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")); }
  catch { return { apiBase: "http://localhost:8001", steamPath: "C:\\Program Files (x86)\\Steam" }; }
}
function storePath() { return path.join(app.getPath("userData"), "store.json"); }
function loadStore() {
  try { return JSON.parse(fs.readFileSync(storePath(), "utf-8")); }
  catch { return { steamPath: null, deviceCode: null, activations: {}, deps: [] }; }
}
function saveStore(s) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(s, null, 2));
}
function getSteamPath() { return loadStore().steamPath || fileConfig().steamPath; }
function getApiBase() { return fileConfig().apiBase.replace(/\/$/, ""); }
function getDeviceCode() {
  // Stable per-PC code derived from the Windows machine GUID (HWID).
  let base = null;
  try { base = machineIdSync ? machineIdSync(true) : null; } catch { base = null; }
  if (base) {
    const hash = crypto.createHash("sha256").update(base).digest("hex").slice(0, 8).toUpperCase();
    return "PC-" + hash;
  }
  // Fallback: persist a random code if HWID is unavailable.
  const s = loadStore();
  if (!s.deviceCode) {
    s.deviceCode = "PC-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    saveStore(s);
  }
  return s.deviceCode;
}
function targetDir(token) {
  const steam = getSteamPath();
  if (token === "steam_config_lua") return path.join(steam, "config", "lua");
  return steam;
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 980, minHeight: 640,
    backgroundColor: "#08090E", autoHideMenuBar: true, title: "Rayzer Stark Game",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}
app.whenReady().then(() => { getDeviceCode(); createWindow(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

async function downloadTo(url, dir, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${filename}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, filename);
  fs.writeFileSync(dest, buf);
  return dest;
}

// ---------- IPC ----------
ipcMain.handle("get-config", () => {
  const s = loadStore();
  return {
    apiBase: getApiBase(), steamPath: getSteamPath(), deviceCode: getDeviceCode(),
    activations: s.activations || {}, depsInstalled: (s.deps || []).length,
  };
});

ipcMain.handle("set-steam-path", (_e, p) => { const s = loadStore(); s.steamPath = p; saveStore(s); return getSteamPath(); });
ipcMain.handle("check-steam-path", () => { const p = getSteamPath(); return { path: p, exists: fs.existsSync(p) }; });
ipcMain.handle("get-status", () => { const s = loadStore(); return { activations: s.activations || {}, depsInstalled: (s.deps || []).length }; });

ipcMain.handle("activate-game", async (event, game) => {
  const api = getApiBase();
  const code = getDeviceCode();
  const res = await fetch(`${api}/api/games/${game.id}/package?device_code=${encodeURIComponent(code)}`);
  if (res.status === 403) throw new Error("Access not released for this device yet.");
  if (!res.ok) throw new Error("Could not fetch injection package");
  const pkg = await res.json();
  if (!pkg.files || pkg.files.length === 0) throw new Error("This game has no .lua files on the server.");
  const written = [];
  for (let i = 0; i < pkg.files.length; i++) {
    const f = pkg.files[i];
    event.sender.send("inject-progress", { gameId: game.id, current: i + 1, total: pkg.files.length, filename: f.filename });
    const url = `${api}/api/files/download?path=${encodeURIComponent(f.download_path)}`;
    const dest = await downloadTo(url, targetDir(f.target), f.filename);
    written.push({ path: dest, filename: f.filename });
  }
  const s = loadStore();
  s.activations = s.activations || {};
  s.activations[game.id] = { title: pkg.title, app_id: pkg.app_id, files: written, activatedAt: new Date().toISOString() };
  saveStore(s);
  return { ok: true, count: written.length };
});

ipcMain.handle("deactivate-game", async (_e, gameId) => {
  const s = loadStore();
  const entry = (s.activations || {})[gameId];
  const removed = [];
  if (entry) {
    for (const f of entry.files) { try { if (fs.existsSync(f.path)) { fs.unlinkSync(f.path); removed.push(f.filename); } } catch {} }
    delete s.activations[gameId];
    saveStore(s);
  }
  return { ok: true, removed };
});

ipcMain.handle("install-dependencies", async (event) => {
  const api = getApiBase();
  const res = await fetch(`${api}/api/dependencies`);
  if (!res.ok) throw new Error("Could not fetch dependencies");
  const deps = await res.json();
  if (!deps.length) throw new Error("No dependencies published yet.");
  const s = loadStore();
  s.deps = s.deps || [];
  for (let i = 0; i < deps.length; i++) {
    const d = deps[i];
    event.sender.send("dep-progress", { current: i + 1, total: deps.length, filename: d.filename });
    const url = `${api}/api/files/download?path=${encodeURIComponent(d.path)}`;
    const dest = await downloadTo(url, targetDir("steam_root"), d.filename);
    if (!s.deps.find((x) => x.path === dest)) s.deps.push({ path: dest, filename: d.filename });
  }
  saveStore(s);
  return { ok: true, count: deps.length };
});

ipcMain.handle("delete-all", async () => {
  const s = loadStore();
  let removed = 0;
  for (const gid of Object.keys(s.activations || {})) {
    for (const f of s.activations[gid].files) { try { if (fs.existsSync(f.path)) { fs.unlinkSync(f.path); removed++; } } catch {} }
  }
  for (const d of s.deps || []) { try { if (fs.existsSync(d.path)) { fs.unlinkSync(d.path); removed++; } } catch {} }
  s.activations = {};
  s.deps = [];
  saveStore(s);
  return { ok: true, removed };
});

ipcMain.handle("download-bypass", async (_e, bypass) => {
  const api = getApiBase();
  const file = bypass && bypass.file;
  if (!file || !file.path) throw new Error("no-file");
  const url = `${api}/api/files/download?path=${encodeURIComponent(file.path)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = app.getPath("downloads");
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, file.filename || "bypass.zip");
  fs.writeFileSync(dest, buf);
  return { ok: true, dest, filename: file.filename };
});
