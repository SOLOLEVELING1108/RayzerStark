const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
function machineGuid() {
  if (process.platform !== "win32") return null;
  try {
    const out = require("child_process").execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: "utf8", windowsHide: true });
    const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i);
    return m ? m[1] : null;
  } catch { return null; }
}

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
  try { base = machineGuid(); } catch { base = null; }
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
function windowIcon() {
  const candidates = [
    path.join(process.resourcesPath || "", "icon.ico"),
    path.join(__dirname, "build", "icon.ico"),
    path.join(__dirname, "renderer", "logo.png"),
  ];
  return candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
}
// The UI is served by our backend so it auto-updates with no re-download.
// Falls back to the bundled renderer if the server can't be reached.
function loadClient() {
  const remote = getApiBase() + "/api/client-app/index.html";
  const bundled = path.join(__dirname, "renderer", "index.html");
  let usedFallback = false;
  win.webContents.on("did-fail-load", (_e, _code, _desc, _url, isMainFrame) => {
    if (isMainFrame && !usedFallback) { usedFallback = true; win.loadFile(bundled); }
  });
  win.loadURL(remote).catch(() => { if (!usedFallback) { usedFallback = true; win.loadFile(bundled); } });
}
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 980, minHeight: 640,
    backgroundColor: "#08090E", autoHideMenuBar: true, title: "Rayzer Stark Game",
    icon: windowIcon(),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  loadClient();
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
  let steamReopened = false;
  if (entry) {
    const steamWas = isSteamRunning();
    if (steamWas) { closeSteam(); await sleep(2000); steamReopened = true; }
    for (const f of entry.files) { if (await unlinkRobust(f.path)) removed.push(f.filename); }
    delete s.activations[gameId];
    saveStore(s);
    if (steamWas) openSteam();
  }
  return { ok: true, removed, steamReopened };
});

const cp = require("child_process");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function unlinkRobust(p) {
  for (let i = 0; i < 4; i++) {
    try { if (!fs.existsSync(p)) return true; fs.unlinkSync(p); return true; }
    catch (e) { if (["EBUSY", "EPERM", "EACCES", "ETXTBSY"].includes(e.code)) { await sleep(500); continue; } return false; }
  }
  return !fs.existsSync(p);
}
function isSteamRunning() {
  if (process.platform !== "win32") return false;
  try { return /steam\.exe/i.test(cp.execSync('tasklist /FI "IMAGENAME eq steam.exe" /NH', { encoding: "utf8", windowsHide: true })); }
  catch { return false; }
}
function closeSteam() {
  if (process.platform !== "win32") return;
  try { cp.execSync("taskkill /IM steam.exe /F /T", { windowsHide: true, stdio: "ignore" }); } catch {}
}
function openSteam() {
  if (process.platform !== "win32") return;
  try {
    const exe = path.join(getSteamPath(), "steam.exe");
    if (fs.existsSync(exe)) { const c = cp.spawn(exe, [], { detached: true, stdio: "ignore" }); c.unref(); }
  } catch {}
}

ipcMain.handle("install-dependencies", async (event) => {
  const api = getApiBase();
  const res = await fetch(`${api}/api/dependencies`);
  if (!res.ok) throw new Error("Could not fetch dependencies");
  const deps = await res.json();
  if (!deps.length) throw new Error("No dependencies published yet.");
  const s = loadStore();
  s.deps = s.deps || [];
  const dir = targetDir("steam_root");
  fs.mkdirSync(dir, { recursive: true });
  // Close Steam first so its DLLs aren't locked; reopen it afterwards.
  const steamWasRunning = isSteamRunning();
  if (steamWasRunning) {
    event.sender.send("dep-progress", { current: 0, total: deps.length, filename: "steam:closing" });
    closeSteam();
    await sleep(2500);
  }
  let installed = 0, skipped = 0; const locked = [];
  const LOCK = ["EBUSY", "EPERM", "EACCES", "ETXTBSY"];
  for (let i = 0; i < deps.length; i++) {
    const d = deps[i];
    event.sender.send("dep-progress", { current: i + 1, total: deps.length, filename: d.filename });
    const url = `${api}/api/files/download?path=${encodeURIComponent(d.path)}`;
    let buf;
    try { const r = await fetch(url); if (!r.ok) throw new Error("dl"); buf = Buffer.from(await r.arrayBuffer()); }
    catch { locked.push(d.filename); continue; }
    const dest = path.join(dir, d.filename);
    try {
      if (fs.existsSync(dest) && fs.statSync(dest).size === buf.length) {
        skipped++;
      } else {
        try {
          fs.writeFileSync(dest, buf);
        } catch (e) {
          if (LOCK.includes(e.code)) {
            const tmp = dest + ".new";
            fs.writeFileSync(tmp, buf);
            try { fs.renameSync(tmp, dest); }
            catch (e2) { try { fs.unlinkSync(tmp); } catch {} throw e2; }
          } else throw e;
        }
        installed++;
      }
      if (!s.deps.find((x) => x.path === dest)) s.deps.push({ path: dest, filename: d.filename });
    } catch (e) {
      if (LOCK.includes(e.code)) locked.push(d.filename);
      else throw e;
    }
  }
  saveStore(s);
  if (steamWasRunning) { openSteam(); }
  return { ok: true, count: installed + skipped, installed, skipped, locked, steamReopened: steamWasRunning };
});

ipcMain.handle("delete-all", async () => {
  const s = loadStore();
  let removed = 0;
  const hasFiles = Object.keys(s.activations || {}).length > 0 || (s.deps || []).length > 0;
  const steamWas = hasFiles && isSteamRunning();
  if (steamWas) { closeSteam(); await sleep(2000); }
  for (const gid of Object.keys(s.activations || {})) {
    for (const f of s.activations[gid].files) { if (await unlinkRobust(f.path)) removed++; }
  }
  for (const d of s.deps || []) { if (await unlinkRobust(d.path)) removed++; }
  s.activations = {};
  s.deps = [];
  saveStore(s);
  if (steamWas) openSteam();
  return { ok: true, removed, steamReopened: steamWas };
});

ipcMain.handle("download-bypass", async (_e, bypass) => {
  const api = getApiBase();
  const file = bypass && bypass.file;
  if (!file || (!file.path && !file.url)) throw new Error("no-file");
  let url = file.url ? file.url : `${api}/api/files/download?path=${encodeURIComponent(file.path)}`;

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
  let cookies = "";
  const grabCookies = (res) => {
    const sc = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    const arr = sc.length ? sc : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
    const jar = {};
    (cookies ? cookies.split("; ") : []).forEach((c) => { const i = c.indexOf("="); if (i > 0) jar[c.slice(0, i)] = c.slice(i + 1); });
    arr.forEach((line) => { const first = line.split(";")[0]; const i = first.indexOf("="); if (i > 0) jar[first.slice(0, i).trim()] = first.slice(i + 1).trim(); });
    cookies = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  };
  const doFetch = (u) => fetch(u, { redirect: "follow", headers: { "User-Agent": UA, ...(cookies ? { Cookie: cookies } : {}) } });

  let res = await doFetch(url);
  grabCookies(res);
  let ct = (res.headers.get("content-type") || "").toLowerCase();

  // Google Drive interstitial (large files / virus-scan): an HTML page with a confirm <form>
  const isGoogle = /google\.com/.test(url);
  if (isGoogle && ct.includes("text/html")) {
    const html = await res.text();
    // Try the modern <form ...action="...download"> with hidden inputs (id, export, confirm, uuid)
    const action = (html.match(/action="([^"]+)"/i) || [])[1];
    let target = null;
    if (action) {
      const params = {}; const re = /name="([^"]+)"\s+value="([^"]*)"/gi; let mm;
      while ((mm = re.exec(html))) params[mm[1]] = mm[2];
      const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
      target = action.replace(/&amp;/g, "&") + (qs ? (action.includes("?") ? "&" : "?") + qs : "");
    }
    if (!target) {
      // Legacy confirm token form
      const tok = (html.match(/confirm=([\w-]+)/) || [])[1];
      const idm = url.match(/[?&]id=([\w-]+)/);
      if (idm) target = `https://drive.usercontent.google.com/download?id=${idm[1]}&export=download${tok ? `&confirm=${tok}` : "&confirm=t"}`;
    }
    if (target) { res = await doFetch(target); grabCookies(res); ct = (res.headers.get("content-type") || "").toLowerCase(); }
  }

  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  if (ct.includes("text/html")) throw new Error("bad-link");

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4096 && buf.slice(0, 200).toString("utf8").toLowerCase().includes("<html")) throw new Error("bad-link");

  let filename = file.filename || "bypass.zip";
  const cd = res.headers.get("content-disposition") || "";
  const fm = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  if (fm) filename = decodeURIComponent(fm[1].replace(/"/g, ""));
  if (!/\.[a-z0-9]{2,4}$/i.test(filename)) filename = (bypass.title || "bypass").replace(/[^\w.-]+/g, "_") + ".zip";

  const dir = app.getPath("downloads");
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, filename);
  fs.writeFileSync(dest, buf);
  return { ok: true, dest, filename };
});

ipcMain.handle("get-key", () => (loadStore().accessKey || ""));
ipcMain.handle("set-key", (_e, k) => { const s = loadStore(); s.accessKey = k; saveStore(s); return true; });
ipcMain.handle("quit-app", () => { app.quit(); });
