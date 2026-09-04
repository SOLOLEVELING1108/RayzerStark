// Fixed loader baked into the .exe. It self-updates the native app code from our
// server (like the Admin loads its UI remotely), so a Republish updates old clients
// with no re-download. This file must stay tiny and stable.
const { app } = require("electron");
const path = require("path");
const fs = require("fs");

const BUNDLED = path.join(__dirname, "app");
const ROOT = path.join(app.getPath("userData"), "native");
const CURRENT = path.join(ROOT, "current");
const NEXT = path.join(ROOT, "next");

function apiBase() {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
    return String(c.apiBase || "").replace(/\/$/, "");
  } catch { return ""; }
}
function verOf(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, "version.json"), "utf-8")).version || "0.0.0"; }
  catch { return "0.0.0"; }
}
function cmp(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
  return 0;
}
function activeDir() {
  try { if (fs.existsSync(path.join(CURRENT, "main.js")) && cmp(verOf(CURRENT), verOf(BUNDLED)) >= 0) return CURRENT; }
  catch {}
  return BUNDLED;
}

async function checkUpdate() {
  const base = apiBase();
  if (!base) return;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(base + "/api/client-native/bundle.json", { signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) return;
    const bundle = await res.json();
    if (!bundle || !bundle.version || !bundle.files) return;
    const active = verOf(activeDir());
    if (cmp(bundle.version, active) <= 0) return;
    fs.rmSync(NEXT, { recursive: true, force: true });
    fs.mkdirSync(NEXT, { recursive: true });
    for (const [rel, b64] of Object.entries(bundle.files)) {
      const dest = path.join(NEXT, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(b64, "base64"));
    }
    fs.writeFileSync(path.join(NEXT, "version.json"), JSON.stringify({ version: bundle.version }));
    if (!fs.existsSync(path.join(NEXT, "main.js"))) { fs.rmSync(NEXT, { recursive: true, force: true }); return; }
    fs.rmSync(CURRENT, { recursive: true, force: true });
    fs.renameSync(NEXT, CURRENT);
  } catch { /* offline / any error → keep current */ }
}

(async () => {
  await checkUpdate();
  const dir = activeDir();
  global.__RAYZER_APPDIR = dir;
  require(path.join(dir, "main.js"));
})();
