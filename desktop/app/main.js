const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cp = require("child_process");
const https = require("https");
const http = require("http");
const AdmZip = require("adm-zip"); // 🔴 O novo motor de extração de ZIP!

const agentHttps = new https.Agent({ keepAlive: true, maxSockets: 100 });
const agentHttp = new http.Agent({ keepAlive: true, maxSockets: 100 });

function downloadFast(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const agent = url.startsWith("https") ? agentHttps : agentHttp;
    lib.get(url, { agent }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFast(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", (err) => { fs.unlink(dest, () => {}); reject(err); });
    }).on("error", reject);
  });
}

function machineGuid() {
  if (process.platform !== "win32") return null;
  try {
    const out = cp.execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: "utf8", windowsHide: true });
    const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i);
    return m ? m[1] : null;
  } catch { return null; }
}

const CONFIG_PATH = path.join(__dirname, "config.json");

function fileConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")); }
  catch { 
    return { apiBase: "https://rayzer-stark.vercel.app", steamPath: "C:\\Program Files (x86)\\Steam" }; 
  }
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

function _verOf(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, "version.json"), "utf-8")).version || "0.0.0"; } catch { return "0.0.0"; } }
function _cmp(a, b) { const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); } return 0; }

async function fetchAndInstallExe() {
  const base = getApiBase();
  try {
    const infoRes = await fetch(base + "/client-build/info");
    if (!infoRes.ok) return false;
    const info = await infoRes.json();
    
    if (!info.available || !info.version || _cmp(info.version, _verOf(__dirname)) <= 0) return false;

    const tempDir = app.getPath("temp");
    const exeDest = path.join(tempDir, "RayzerStark_Update.exe");
    
    const dlRes = await fetch(base + "/client-build/download");
    if (!dlRes.ok) return false;
    
    const buf = Buffer.from(await dlRes.arrayBuffer());
    fs.writeFileSync(exeDest, buf);
    
    const child = cp.spawn(exeDest, ["/SILENT"], { detached: true, stdio: 'ignore' });
    child.unref();
    app.quit();
    return true; 
  } catch (e) {
    console.error("Erro na atualização silenciosa:", e);
    return false;
  }
}

ipcMain.handle("check-native-update", async () => {
  const updated = await fetchAndInstallExe();
  return { updated };
});

function getDeviceCode() {
  let base = null;
  try { base = machineGuid(); } catch { base = null; }
  if (base) {
    const hash = crypto.createHash("sha256").update(base).digest("hex").slice(0, 8).toUpperCase();
    return "PC-" + hash;
  }
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

function loadClient() {
  const bundled = path.join(__dirname, "renderer", "index.html");
  win.loadFile(bundled);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 980, minHeight: 640,
    backgroundColor: "#08090E", autoHideMenuBar: true, title: "Rayzer Stark Game",
    icon: windowIcon(),
    fullscreen: true,
    frame: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.maximize();
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
    version: _verOf(__dirname),
  };
});
ipcMain.handle("set-steam-path", (_e, p) => { const s = loadStore(); s.steamPath = p; saveStore(s); return getSteamPath(); });
ipcMain.handle("check-steam-path", () => { const p = getSteamPath(); return { path: p, exists: fs.existsSync(p) }; });
ipcMain.handle("get-status", () => { const s = loadStore(); return { activations: s.activations || {}, depsInstalled: (s.deps || []).length }; });

// 🔴 A NOVA ATIVAÇÃO REVOLUCIONÁRIA VIA API 🔴
ipcMain.handle("activate-game", async (event, game) => {
  // Ignora o INIT de manifests soltos, pois agora tudo vem empacotado no jogo!
  if (game.id === "MANIFEST_INIT") return { ok: true };

  const code = getDeviceCode();
  const api = getApiBase();

  // Opcional: Ainda checa se o jogador tem a liberação comprada pelo seu painel (se você usa esse sistema)
  const authRes = await fetch(`${api}/api/games/${game.id}/package?device_code=${encodeURIComponent(code)}`);
  if (authRes.status === 403) throw new Error("Acesso não liberado para este dispositivo ainda.");

  // 1. Prepara a URL dinâmica e as pastas temporárias do Windows
  const dlUrl = `https://generator.ryuu.lol/secure_download?appid=${game.app_id}&auth_code=RYUUMANIFEST43dvt2`;
  const tempZip = path.join(app.getPath("temp"), `rayzer_${game.app_id}_${Date.now()}.zip`);
  const extractDir = path.join(app.getPath("temp"), `ext_${game.app_id}_${Date.now()}`);

  event.sender.send("inject-progress", { gameId: game.id, current: 1, total: 3, filename: "Baixando pacote do jogo da nuvem..." });
  
  // 2. Baixa o ZIP
  try {
    await downloadFast(dlUrl, tempZip);
  } catch (err) {
    throw new Error("Falha ao baixar os arquivos da API. Verifique sua conexão.");
  }

  event.sender.send("inject-progress", { gameId: game.id, current: 2, total: 3, filename: "Extraindo e instalando arquivos..." });

  // 3. Extrai o ZIP silenciosamente
  try {
    const zip = new AdmZip(tempZip);
    zip.extractAllTo(extractDir, true);
  } catch (err) {
    try { fs.unlinkSync(tempZip); } catch(e){}
    throw new Error("Falha ao extrair o pacote zipado.");
  }

  // 4. Pastas de destino
  const luaTarget = targetDir("steam_config_lua");
  const manifestTarget = path.join(targetDir("steam_root"), "depotcache");
  const written = [];

  // Função peneira: caça .lua e .manifest dentro do zip extraído
  function processExtracted(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        processExtracted(full); // Mergulha em sub-pastas, se houver
      } else {
        const lower = item.toLowerCase();
        if (lower.endsWith(".lua")) {
          fs.mkdirSync(luaTarget, { recursive: true });
          const dest = path.join(luaTarget, item);
          fs.copyFileSync(full, dest);
          written.push({ path: dest, filename: item });
        } else if (lower.endsWith(".manifest")) {
          fs.mkdirSync(manifestTarget, { recursive: true });
          const dest = path.join(manifestTarget, item);
          fs.copyFileSync(full, dest);
          written.push({ path: dest, filename: item });
        }
      }
    }
  }

  processExtracted(extractDir);

  // 5. Apaga as provas do crime (deleta o zip e a pasta temporária)
  try { fs.unlinkSync(tempZip); } catch(e){}
  try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch(e){}

  if (written.length === 0) {
     throw new Error("O pacote zipado baixado não continha nenhum arquivo .lua ou .manifest compatível.");
  }

  // 6. Salva as informações de ativação para poder desinstalar no futuro
  const s = loadStore();
  s.activations = s.activations || {};
  s.activations[game.id] = { title: game.title, app_id: game.app_id, files: written, activatedAt: new Date().toISOString() };
  saveStore(s);

  event.sender.send("inject-progress", { gameId: game.id, current: 3, total: 3, filename: "Concluído com sucesso!" });
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
      if (fs.existsSync(dest) && fs.statSync(dest).size === buf.length) { skipped++; } 
      else {
        try { fs.writeFileSync(dest, buf); } 
        catch (e) {
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
  const isGoogle = /google\.com/.test(url);
  if (isGoogle && ct.includes("text/html")) {
    const html = await res.text();
    const action = (html.match(/action="([^"]+)"/i) || [])[1];
    let target = null;
    if (action) {
      const params = {}; const re = /name="([^"]+)"\s+value="([^"]*)"/gi; let mm;
      while ((mm = re.exec(html))) params[mm[1]] = mm[2];
      const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
      target = action.replace(/&amp;/g, "&") + (qs ? (action.includes("?") ? "&" : "?") + qs : "");
    }
    if (!target) {
      const tok = (html.match(/confirm=([\w-]+)/) || [])[1];
      const idm = url.match(/[?&]id=([\w-]+)/);
      if (idm) target = `https://driveusercontent.google.com/download?id=${idm[1]}&export=download${tok ? `&confirm=${tok}` : "&confirm=t"}`;
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
ipcMain.handle("minimize-app", () => { if (win) win.minimize(); });