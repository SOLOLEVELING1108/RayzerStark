let CONFIG = { apiBase: "", steamPath: "", deviceCode: "" };
let SETTINGS = { pix_type: "", pix_key: "", pix_holder: "" };
let LIB = [];
let STORE = [];
let searchTerm = "";
const injecting = {};
let buyGame = null;

const $ = (s) => document.querySelector(s);
const grid = $("#grid");
const storeGrid = $("#store-grid");

function toast(title, desc, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="t-title">${title}</div>${desc ? `<div class="t-desc">${desc}</div>` : ""}`;
  $("#toast-wrap").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3800);
}
async function apiGet(p) { const r = await fetch(`${CONFIG.apiBase}${p}`); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
function coverUrl(u) { return !u ? "" : (u.startsWith("http") ? u : `${CONFIG.apiBase}${u}`); }

// ---------- LIBRARY ----------
function libCardHtml(g) {
  const lua = (g.lua_files || []).length;
  const active = CONFIG.activations && CONFIG.activations[g.id];
  const busy = injecting[g.id];
  const cover = coverUrl(g.cover_url);
  const tag = g.source === "public" ? `<span class="badge-active" style="background:rgba(16,185,129,.15);color:#10B981;border-color:rgba(16,185,129,.3)">GRÁTIS</span>` : "";
  return `<div class="gcard" data-card="${g.id}">
    <div class="cover">${cover ? `<img src="${cover}"/>` : ""}<span class="appid">APPID ${g.app_id}</span>
      ${active ? `<span class="badge-active">● Ativo</span>` : tag}</div>
    <div class="gbody">
      <div class="gtitle">${g.title}</div>
      <div class="gcat">${g.category || ""}</div>
      <div class="counts"><span class="c-lua">‹/› ${lua} LUA</span></div>
      <div class="actions">
        ${active ? `<button class="btn success full deactivate" data-testid="deactivate-${g.app_id}">✓ Ativado — Remover</button>`
                 : `<button class="btn full activate" data-testid="activate-${g.app_id}" ${busy ? "disabled" : ""}>${busy ? "Injetando…" : "⚡ Ativar"}</button>`}
      </div>
      <div class="progress hidden" data-progress="${g.id}"><div></div></div>
      <div class="progress-label hidden" data-plabel="${g.id}"></div>
    </div></div>`;
}
function renderLib() {
  const list = LIB.filter((g) => { const s = searchTerm.toLowerCase(); return !s || g.title.toLowerCase().includes(s) || String(g.app_id).includes(s); });
  $("#empty-lib").classList.toggle("hidden", list.length > 0);
  grid.innerHTML = list.map(libCardHtml).join("");
  list.forEach((g) => {
    const root = grid.querySelector(`[data-card="${g.id}"]`);
    root?.querySelector(".activate")?.addEventListener("click", () => activate(g));
    root?.querySelector(".deactivate")?.addEventListener("click", () => deactivate(g));
  });
}
async function activate(g) {
  if (injecting[g.id]) return;
  injecting[g.id] = true; renderLib();
  grid.querySelector(`[data-progress="${g.id}"]`)?.classList.remove("hidden");
  grid.querySelector(`[data-plabel="${g.id}"]`)?.classList.remove("hidden");
  try {
    const res = await window.api.activateGame(g);
    toast("Ativado: " + g.title, `${res.count} arquivo(s) .lua injetado(s)`, "ok");
    CONFIG = await window.api.getConfig();
  } catch (e) { toast("Falha ao ativar", e.message, "err"); }
  finally { injecting[g.id] = false; renderLib(); }
}
async function deactivate(g) {
  try {
    const res = await window.api.deactivateGame(g.id);
    toast("Removido: " + g.title, `${res.removed.length} arquivo(s) apagado(s)`, "info");
    CONFIG = await window.api.getConfig(); renderLib();
  } catch (e) { toast("Falha ao remover", e.message, "err"); }
}
window.api.onProgress((d) => {
  const bar = grid.querySelector(`[data-progress="${d.gameId}"] > div`);
  const label = grid.querySelector(`[data-plabel="${d.gameId}"]`);
  if (bar) bar.style.width = `${Math.round((d.current / d.total) * 100)}%`;
  if (label) label.textContent = `→ ${d.filename} (${d.current}/${d.total})`;
});

// ---------- STORE ----------
function storeCardHtml(g) {
  const cover = coverUrl(g.cover_url);
  let action;
  if (g.owned) action = `<button class="btn success full" disabled>✓ Você já tem</button>`;
  else if (g.pending) action = `<button class="btn full" disabled style="background:#3a3320;color:#F59E0B">⏳ Aguardando liberação</button>`;
  else action = `<button class="btn full buy" data-buy="${g.id}">Comprar — R$ ${Number(g.price).toFixed(2)}</button>`;
  return `<div class="gcard" data-scard="${g.id}">
    <div class="cover">${cover ? `<img src="${cover}"/>` : ""}<span class="appid">APPID ${g.app_id}</span></div>
    <div class="gbody"><div class="gtitle">${g.title}</div><div class="gcat">${g.category || ""}</div>
      <div class="counts"><span class="price-tag">R$ ${Number(g.price).toFixed(2)}</span></div>
      <div class="actions">${action}</div></div></div>`;
}
function renderStore() {
  $("#empty-store").classList.toggle("hidden", STORE.length > 0);
  storeGrid.innerHTML = STORE.map(storeCardHtml).join("");
  STORE.forEach((g) => storeGrid.querySelector(`[data-buy="${g.id}"]`)?.addEventListener("click", () => openBuy(g)));
}
function openBuy(g) {
  buyGame = g;
  $("#modal-title").textContent = "Comprar: " + g.title;
  $("#modal-price").textContent = `Valor: R$ ${Number(g.price).toFixed(2)}`;
  $("#pix-type").textContent = SETTINGS.pix_type || "-";
  $("#pix-key").textContent = SETTINGS.pix_key || "-";
  $("#pix-holder").textContent = SETTINGS.pix_holder || "-";
  $("#modal-device").textContent = "Seu código: " + CONFIG.deviceCode;
  $("#receipt-input").value = ""; $("#buyer-name").value = "";
  $("#modal").classList.remove("hidden");
}
$("#modal-close").addEventListener("click", () => $("#modal").classList.add("hidden"));
$("#pix-key").addEventListener("click", () => { navigator.clipboard.writeText(SETTINGS.pix_key || "").then(() => toast("Chave Pix copiada", "", "ok")).catch(() => {}); });
$("#submit-purchase").addEventListener("click", async () => {
  const file = $("#receipt-input").files?.[0];
  if (!file) { toast("Anexe o comprovante", "", "err"); return; }
  try {
    const fd = new FormData();
    fd.append("device_code", CONFIG.deviceCode);
    fd.append("device_name", $("#buyer-name").value || "");
    fd.append("game_id", buyGame.id);
    fd.append("receipt", file);
    const r = await fetch(`${CONFIG.apiBase}/api/purchases`, { method: "POST", body: fd });
    if (!r.ok) throw new Error("HTTP " + r.status);
    toast("Comprovante enviado!", "Aguarde a liberação do administrador.", "ok");
    $("#modal").classList.add("hidden");
    await loadStore();
  } catch (e) { toast("Falha ao enviar", e.message, "err"); }
});

// ---------- SETTINGS ----------
$("#install-deps-btn").addEventListener("click", async () => {
  const btn = $("#install-deps-btn"); btn.disabled = true; btn.textContent = "Instalando…";
  try {
    const res = await window.api.installDependencies();
    toast("Dependências instaladas", `${res.count} DLL(s) na raiz da Steam`, "ok");
    CONFIG = await window.api.getConfig(); updateSettingsUI();
  } catch (e) { toast("Falha", e.message, "err"); }
  finally { btn.disabled = false; btn.textContent = "Instalar dependências"; }
});
window.api.onDepProgress((d) => { $("#deps-progress-label").textContent = `→ ${d.filename} (${d.current}/${d.total})`; });
$("#delete-all-btn").addEventListener("click", async () => {
  if (!confirm("Excluir permanentemente todos os arquivos injetados (DLLs e .lua) deste PC?")) return;
  try {
    const res = await window.api.deleteAll();
    toast("Exclusão concluída", `${res.removed} arquivo(s) removido(s)`, "info");
    CONFIG = await window.api.getConfig(); updateSettingsUI(); renderLib();
  } catch (e) { toast("Falha", e.message, "err"); }
});
$("#save-path-btn").addEventListener("click", async () => {
  CONFIG.steamPath = await window.api.setSteamPath($("#steam-path-input").value.trim());
  toast("Pasta salva", CONFIG.steamPath, "ok"); await updateSteamUI();
});

function updateSettingsUI() {
  $("#deps-target").textContent = CONFIG.steamPath + "\\";
  $("#deps-status").textContent = CONFIG.depsInstalled ? `${CONFIG.depsInstalled} dependência(s) instalada(s) neste PC.` : "Nenhuma dependência instalada ainda.";
  $("#device-code").textContent = CONFIG.deviceCode;
  $("#device-foot").textContent = CONFIG.deviceCode;
  $("#steam-path-input").value = CONFIG.steamPath;
}
async function updateSteamUI() {
  $("#steam-path-label").textContent = CONFIG.steamPath;
  const chk = await window.api.checkSteamPath();
  const s = $("#steam-status"), pc = $("#path-check");
  if (chk.exists) { s.className = "steam-status ok"; s.textContent = "● Pasta da Steam encontrada"; if (pc) { pc.className = "path-check ok"; pc.textContent = "✓ Pasta existe"; } }
  else { s.className = "steam-status bad"; s.textContent = "▲ Steam não encontrada"; if (pc) { pc.className = "path-check bad"; pc.textContent = "▲ Ajuste o caminho da Steam."; } }
}

// ---------- NAV ----------
const titles = { library: "Biblioteca", store: "Loja", settings: "Configurações" };
document.querySelectorAll(".nav-item").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  const v = b.dataset.view;
  $("#view-title").textContent = titles[v];
  $("#view-library").classList.toggle("hidden", v !== "library");
  $("#view-store").classList.toggle("hidden", v !== "store");
  $("#view-settings").classList.toggle("hidden", v !== "settings");
  if (v === "store") loadStore();
}));
$("#search").addEventListener("input", (e) => { searchTerm = e.target.value; renderLib(); });
$("#refresh-lib").addEventListener("click", loadLibrary);
$("#refresh-store").addEventListener("click", loadStore);

async function loadLibrary() {
  try { LIB = await apiGet(`/api/library?device_code=${encodeURIComponent(CONFIG.deviceCode)}`); renderLib(); }
  catch (e) { toast("Servidor indisponível", CONFIG.apiBase, "err"); $("#empty-lib").classList.remove("hidden"); }
}
async function loadStore() {
  try {
    SETTINGS = await apiGet(`/api/settings`);
    STORE = await apiGet(`/api/store?device_code=${encodeURIComponent(CONFIG.deviceCode)}`);
    renderStore();
  } catch (e) { toast("Falha ao carregar loja", e.message, "err"); }
}

async function init() {
  CONFIG = await window.api.getConfig();
  updateSettingsUI();
  await updateSteamUI();
  await loadLibrary();
}
init();
