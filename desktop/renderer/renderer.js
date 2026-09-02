let CONFIG = { apiBase: "", steamPath: "", deviceCode: "" };
let SETTINGS = { pix_type: "", pix_key: "", pix_holder: "" };
let LIB = [], STORE = [], BYPASS = [];
let searchTerm = "", bypassSearch = "";
const injecting = {}, downloading = {};
let buyGame = null;
let LANG = localStorage.getItem("lang") || "pt";
let currentView = "library";

const TR = {
  pt: {
    "nav.library": "Biblioteca", "nav.bypass": "Bypass", "nav.store": "Loja", "nav.settings": "Configurações",
    "common.refresh": "↻ Atualizar",
    "lib.title": "Biblioteca", "lib.subtitle": "Seus jogos liberados. Clique em Ativar.", "lib.empty": "Nenhum jogo liberado ainda. Vá até a Loja.", "lib.searchPh": "Buscar por título ou App ID…",
    "bp.title": "Bypass", "bp.subtitle": "Baixe o bypass do jogo direto para a pasta Downloads.", "bp.empty": "Nenhum bypass disponível.", "bp.searchPh": "Buscar bypass…", "bp.download": "⬇ Baixar", "bp.downloading": "Baixando…", "bp.noFile": "Sem arquivo",
    "store.title": "Loja", "store.subtitle": "Compre via Pix e envie o comprovante.", "store.empty": "Nenhum jogo à venda.",
    "set.title": "Configurações", "set.lang": "Idioma", "set.langDesc": "Escolha o idioma do aplicativo.",
    "set.deps": "Instalar dependências", "set.depsDesc": "Baixa e instala os arquivos necessários automaticamente.", "set.depsBtn": "Instalar dependências",
    "set.del": "Exclusões", "set.delDesc": "Remove permanentemente deste PC todos os arquivos dos jogos ativados.", "set.delBtn": "Excluir todos os jogos",
    "set.device": "Este dispositivo", "set.deviceDesc": "Envie este código junto do comprovante para liberar seu acesso:",
    "pix.type": "Tipo", "pix.key": "Chave Pix", "pix.holder": "Titular", "pix.receipt": "Comprovante (imagem)", "pix.name": "Seu nome/apelido (opcional)", "pix.send": "Enviar comprovante",
    "changing": "Mudando idioma…", "activate": "⚡ Ativar", "injecting": "Instalando…", "activated": "✓ Ativado — Remover", "free": "GRÁTIS", "active": "● Ativo",
    "buy": "Comprar", "owned": "✓ Você já tem", "pendingBtn": "⏳ Aguardando liberação", "installing": "Instalando",
    "t.activated": "Ativado", "t.filesInj": "arquivo(s) instalado(s)", "t.removed": "Removido", "t.filesDel": "arquivo(s) apagado(s)",
    "t.actFail": "Falha ao ativar", "t.notReleased": "Acesso ainda não liberado para este dispositivo.", "t.noFiles": "Este jogo não tem arquivos no servidor.",
    "t.depsOk": "Dependências instaladas", "t.depsFail": "Falha ao instalar", "t.deleteDone": "Exclusão concluída", "t.receiptSent": "Comprovante enviado!", "t.wait": "Aguarde a liberação do administrador.",
    "t.attach": "Anexe o comprovante", "t.sendFail": "Falha ao enviar", "t.pixCopied": "Chave Pix copiada", "t.bpOk": "Bypass baixado para a pasta Downloads", "t.bpNoFile": "Este bypass não tem arquivo.", "t.dlFail": "Falha ao baixar",
    "t.serverDown": "Servidor indisponível", "t.storeFail": "Falha ao carregar loja", "t.confirmDel": "Excluir permanentemente todos os arquivos deste PC?",
    "steam.ok": "● Steam encontrada", "steam.bad": "▲ Steam não encontrada", "deps.count": "dependência(s) instalada(s).", "deps.none": "Nenhuma dependência instalada ainda.",
  },
  en: {
    "nav.library": "Library", "nav.bypass": "Bypass", "nav.store": "Store", "nav.settings": "Settings",
    "common.refresh": "↻ Refresh",
    "lib.title": "Library", "lib.subtitle": "Your released games. Click Activate.", "lib.empty": "No games yet. Visit the Store.", "lib.searchPh": "Search by title or App ID…",
    "bp.title": "Bypass", "bp.subtitle": "Download the game bypass straight to your Downloads folder.", "bp.empty": "No bypass available.", "bp.searchPh": "Search bypass…", "bp.download": "⬇ Download", "bp.downloading": "Downloading…", "bp.noFile": "No file",
    "store.title": "Store", "store.subtitle": "Buy with Pix and send the receipt.", "store.empty": "No games for sale.",
    "set.title": "Settings", "set.lang": "Language", "set.langDesc": "Choose the app language.",
    "set.deps": "Install dependencies", "set.depsDesc": "Downloads and installs the required files automatically.", "set.depsBtn": "Install dependencies",
    "set.del": "Deletions", "set.delDesc": "Permanently removes from this PC all files of activated games.", "set.delBtn": "Delete all games",
    "set.device": "This device", "set.deviceDesc": "Send this code with your receipt to release your access:",
    "pix.type": "Type", "pix.key": "Pix Key", "pix.holder": "Holder", "pix.receipt": "Receipt (image)", "pix.name": "Your name/nickname (optional)", "pix.send": "Send receipt",
    "changing": "Changing language…", "activate": "⚡ Activate", "injecting": "Installing…", "activated": "✓ Activated — Remove", "free": "FREE", "active": "● Active",
    "buy": "Buy", "owned": "✓ You own it", "pendingBtn": "⏳ Waiting approval", "installing": "Installing",
    "t.activated": "Activated", "t.filesInj": "file(s) installed", "t.removed": "Removed", "t.filesDel": "file(s) deleted",
    "t.actFail": "Activation failed", "t.notReleased": "Access not released for this device yet.", "t.noFiles": "This game has no files on the server.",
    "t.depsOk": "Dependencies installed", "t.depsFail": "Install failed", "t.deleteDone": "Deletion complete", "t.receiptSent": "Receipt sent!", "t.wait": "Wait for the admin to release it.",
    "t.attach": "Attach the receipt", "t.sendFail": "Send failed", "t.pixCopied": "Pix key copied", "t.bpOk": "Bypass downloaded to your Downloads folder", "t.bpNoFile": "This bypass has no file.", "t.dlFail": "Download failed",
    "t.serverDown": "Server unavailable", "t.storeFail": "Failed to load store", "t.confirmDel": "Permanently delete all files from this PC?",
    "steam.ok": "● Steam found", "steam.bad": "▲ Steam not found", "deps.count": "dependency(ies) installed.", "deps.none": "No dependencies installed yet.",
  },
  es: {
    "nav.library": "Biblioteca", "nav.bypass": "Bypass", "nav.store": "Tienda", "nav.settings": "Ajustes",
    "common.refresh": "↻ Actualizar",
    "lib.title": "Biblioteca", "lib.subtitle": "Tus juegos liberados. Pulsa Activar.", "lib.empty": "Aún no hay juegos. Ve a la Tienda.", "lib.searchPh": "Buscar por título o App ID…",
    "bp.title": "Bypass", "bp.subtitle": "Descarga el bypass del juego directo a la carpeta Descargas.", "bp.empty": "No hay bypass disponible.", "bp.searchPh": "Buscar bypass…", "bp.download": "⬇ Descargar", "bp.downloading": "Descargando…", "bp.noFile": "Sin archivo",
    "store.title": "Tienda", "store.subtitle": "Compra con Pix y envía el comprobante.", "store.empty": "No hay juegos a la venta.",
    "set.title": "Ajustes", "set.lang": "Idioma", "set.langDesc": "Elige el idioma de la app.",
    "set.deps": "Instalar dependencias", "set.depsDesc": "Descarga e instala los archivos necesarios automáticamente.", "set.depsBtn": "Instalar dependencias",
    "set.del": "Eliminaciones", "set.delDesc": "Elimina permanentemente de este PC todos los archivos de los juegos activados.", "set.delBtn": "Eliminar todos los juegos",
    "set.device": "Este dispositivo", "set.deviceDesc": "Envía este código con tu comprobante para liberar tu acceso:",
    "pix.type": "Tipo", "pix.key": "Clave Pix", "pix.holder": "Titular", "pix.receipt": "Comprobante (imagen)", "pix.name": "Tu nombre/apodo (opcional)", "pix.send": "Enviar comprobante",
    "changing": "Cambiando idioma…", "activate": "⚡ Activar", "injecting": "Instalando…", "activated": "✓ Activado — Quitar", "free": "GRATIS", "active": "● Activo",
    "buy": "Comprar", "owned": "✓ Ya lo tienes", "pendingBtn": "⏳ Esperando aprobación", "installing": "Instalando",
    "t.activated": "Activado", "t.filesInj": "archivo(s) instalado(s)", "t.removed": "Quitado", "t.filesDel": "archivo(s) borrado(s)",
    "t.actFail": "Error al activar", "t.notReleased": "Acceso no liberado para este dispositivo aún.", "t.noFiles": "Este juego no tiene archivos en el servidor.",
    "t.depsOk": "Dependencias instaladas", "t.depsFail": "Error al instalar", "t.deleteDone": "Eliminación completa", "t.receiptSent": "¡Comprobante enviado!", "t.wait": "Espera a que el administrador lo libere.",
    "t.attach": "Adjunta el comprobante", "t.sendFail": "Error al enviar", "t.pixCopied": "Clave Pix copiada", "t.bpOk": "Bypass descargado a la carpeta Descargas", "t.bpNoFile": "Este bypass no tiene archivo.", "t.dlFail": "Error al descargar",
    "t.serverDown": "Servidor no disponible", "t.storeFail": "Error al cargar la tienda", "t.confirmDel": "¿Eliminar permanentemente todos los archivos de este PC?",
    "steam.ok": "● Steam encontrada", "steam.bad": "▲ Steam no encontrada", "deps.count": "dependencia(s) instalada(s).", "deps.none": "Ninguna dependencia instalada aún.",
  },
};
const LANGS = [{ code: "pt", label: "Português", flag: "🇧🇷" }, { code: "en", label: "English", flag: "🇺🇸" }, { code: "es", label: "Español", flag: "🇪🇸" }];
const tr = (k) => (TR[LANG] && TR[LANG][k]) || TR.pt[k] || k;

const GATE = {
  pt: { enter: "Digite sua key de acesso para continuar", activate: "Ativar", invalid: "Key inválida.", other: "Esta key já está em uso em outro PC.", blocked: "Key inválida ou usada em outro computador. O aplicativo será fechado.", close: "Fechar", checking: "Verificando…" },
  en: { enter: "Enter your access key to continue", activate: "Activate", invalid: "Invalid key.", other: "This key is already used on another PC.", blocked: "Invalid key or used on another computer. The app will close.", close: "Close", checking: "Checking…" },
  es: { enter: "Ingresa tu clave de acceso para continuar", activate: "Activar", invalid: "Clave inválida.", other: "Esta clave ya se usa en otro PC.", blocked: "Clave inválida o usada en otro equipo. La app se cerrará.", close: "Cerrar", checking: "Verificando…" },
};
const gt = (k) => (GATE[LANG] && GATE[LANG][k]) || GATE.pt[k];

const $ = (s) => document.querySelector(s);
const grid = $("#grid"), storeGrid = $("#store-grid"), bypassGrid = $("#bypass-grid");

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
  const active = CONFIG.activations && CONFIG.activations[g.id];
  const busy = injecting[g.id];
  const cover = coverUrl(g.cover_url);
  const bp = BYPASS.find((b) => String(b.app_id) === String(g.app_id) && b.file && b.file.filename);
  const tag = g.source === "public" ? `<span class="badge-active" style="background:rgba(16,185,129,.15);color:#10B981;border-color:rgba(16,185,129,.3)">${tr("free")}</span>` : "";
  return `<div class="gcard" data-card="${g.id}">
    <div class="cover">${cover ? `<img src="${cover}"/>` : ""}<span class="appid">APPID ${g.app_id}</span>
      ${active ? `<span class="badge-active">${tr("active")}</span>` : tag}</div>
    <div class="gbody">
      <div class="gtitle">${g.title}</div>
      <div class="gcat">${g.category || ""}</div>
      <div class="actions" style="margin-top:14px">
        ${active ? `<button class="btn success full deactivate">${tr("activated")}</button>`
                 : `<button class="btn full activate" ${busy ? "disabled" : ""}>${busy ? tr("injecting") : tr("activate")}</button>`}
      </div>
      ${bp ? `<button class="btn full lib-bypass" data-bp="${bp.id}" style="margin-top:8px;background:#161b2b;color:#22D3EE;border:1px solid rgba(6,182,212,.35)">${downloading[bp.id] ? tr("bp.downloading") : tr("bp.download") + " Bypass"}</button>` : ""}
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
    const bpBtn = root?.querySelector(".lib-bypass");
    if (bpBtn) {
      const bp = BYPASS.find((b) => b.id === bpBtn.dataset.bp);
      bpBtn.addEventListener("click", () => bp && downloadBypass(bp));
    }
  });
}
async function activate(g) {
  if (injecting[g.id]) return;
  injecting[g.id] = true; renderLib();
  grid.querySelector(`[data-progress="${g.id}"]`)?.classList.remove("hidden");
  grid.querySelector(`[data-plabel="${g.id}"]`)?.classList.remove("hidden");
  try {
    const res = await window.api.activateGame(g);
    toast(tr("t.activated") + ": " + g.title, `${res.count} ${tr("t.filesInj")}`, "ok");
    CONFIG = await window.api.getConfig();
  } catch (e) {
    const msg = e.message.includes("not released") ? tr("t.notReleased") : (e.message.includes("no .lua") ? tr("t.noFiles") : tr("t.actFail"));
    toast(tr("t.actFail"), msg, "err");
  } finally { injecting[g.id] = false; renderLib(); }
}
async function deactivate(g) {
  try {
    const res = await window.api.deactivateGame(g.id);
    toast(tr("t.removed") + ": " + g.title, `${res.removed.length} ${tr("t.filesDel")}`, "info");
    CONFIG = await window.api.getConfig(); renderLib();
  } catch (e) { toast(tr("t.actFail"), e.message, "err"); }
}
window.api.onProgress((d) => {
  const bar = grid.querySelector(`[data-progress="${d.gameId}"] > div`);
  const label = grid.querySelector(`[data-plabel="${d.gameId}"]`);
  if (bar) bar.style.width = `${Math.round((d.current / d.total) * 100)}%`;
  if (label) label.textContent = `${tr("installing")} (${d.current}/${d.total})`;
});

// ---------- BYPASS ----------
function bypassCardHtml(b) {
  const cover = coverUrl(b.cover_url);
  const busy = downloading[b.id];
  const hasFile = b.file && b.file.filename;
  return `<div class="gcard" data-bcard="${b.id}">
    <div class="cover">${cover ? `<img src="${cover}"/>` : ""}<span class="appid">APPID ${b.app_id}</span></div>
    <div class="gbody"><div class="gtitle">${b.title}</div><div class="gcat">${b.category || ""}</div>
      <div class="actions" style="margin-top:14px">
        ${hasFile ? `<button class="btn full dl" ${busy ? "disabled" : ""}>${busy ? tr("bp.downloading") : tr("bp.download")}</button>`
                  : `<button class="btn full" disabled style="opacity:.5">${tr("bp.noFile")}</button>`}
      </div></div></div>`;
}
function renderBypass() {
  const list = BYPASS.filter((b) => { const s = bypassSearch.toLowerCase(); return !s || b.title.toLowerCase().includes(s) || String(b.app_id).includes(s); });
  $("#empty-bypass").classList.toggle("hidden", list.length > 0);
  bypassGrid.innerHTML = list.map(bypassCardHtml).join("");
  list.forEach((b) => bypassGrid.querySelector(`[data-bcard="${b.id}"] .dl`)?.addEventListener("click", () => downloadBypass(b)));
}
async function downloadBypass(b) {
  if (downloading[b.id]) return;
  downloading[b.id] = true; renderBypass(); renderLib();
  try {
    const res = await window.api.downloadBypass(b);
    toast(b.title, `${tr("t.bpOk")}: ${res.filename}`, "ok");
  } catch (e) {
    toast(tr("t.dlFail"), e.message === "no-file" ? tr("t.bpNoFile") : e.message, "err");
  } finally { downloading[b.id] = false; renderBypass(); renderLib(); }
}

// ---------- STORE ----------
function storeCardHtml(g) {
  const cover = coverUrl(g.cover_url);
  let action;
  if (g.owned) action = `<button class="btn success full" disabled>${tr("owned")}</button>`;
  else if (g.pending) action = `<button class="btn full" disabled style="background:#3a3320;color:#F59E0B">${tr("pendingBtn")}</button>`;
  else action = `<button class="btn full buy">${tr("buy")} — R$ ${Number(g.price).toFixed(2)}</button>`;
  return `<div class="gcard" data-scard="${g.id}">
    <div class="cover">${cover ? `<img src="${cover}"/>` : ""}<span class="appid">APPID ${g.app_id}</span></div>
    <div class="gbody"><div class="gtitle">${g.title}</div><div class="gcat">${g.category || ""}</div>
      <div class="counts"><span class="price-tag">R$ ${Number(g.price).toFixed(2)}</span></div>
      <div class="actions">${action}</div></div></div>`;
}
function renderStore() {
  $("#empty-store").classList.toggle("hidden", STORE.length > 0);
  storeGrid.innerHTML = STORE.map(storeCardHtml).join("");
  STORE.forEach((g) => storeGrid.querySelector(`[data-scard="${g.id}"] .buy`)?.addEventListener("click", () => openBuy(g)));
}
function openBuy(g) {
  buyGame = g;
  $("#modal-title").textContent = tr("buy") + ": " + g.title;
  $("#modal-price").textContent = `R$ ${Number(g.price).toFixed(2)}`;
  $("#pix-type").textContent = SETTINGS.pix_type || "-";
  $("#pix-key").textContent = SETTINGS.pix_key || "-";
  $("#pix-holder").textContent = SETTINGS.pix_holder || "-";
  $("#modal-device").textContent = CONFIG.deviceCode;
  $("#receipt-input").value = ""; $("#buyer-name").value = "";
  $("#modal").classList.remove("hidden");
}
$("#modal-close").addEventListener("click", () => $("#modal").classList.add("hidden"));
$("#pix-key").addEventListener("click", () => { navigator.clipboard.writeText(SETTINGS.pix_key || "").then(() => toast(tr("t.pixCopied"), "", "ok")).catch(() => {}); });
$("#submit-purchase").addEventListener("click", async () => {
  const file = $("#receipt-input").files?.[0];
  if (!file) { toast(tr("t.attach"), "", "err"); return; }
  try {
    const fd = new FormData();
    fd.append("device_code", CONFIG.deviceCode);
    fd.append("device_name", $("#buyer-name").value || "");
    fd.append("game_id", buyGame.id);
    fd.append("receipt", file);
    const r = await fetch(`${CONFIG.apiBase}/api/purchases`, { method: "POST", body: fd });
    if (!r.ok) throw new Error("HTTP " + r.status);
    toast(tr("t.receiptSent"), tr("t.wait"), "ok");
    $("#modal").classList.add("hidden");
    await loadStore();
  } catch (e) { toast(tr("t.sendFail"), e.message, "err"); }
});

// ---------- SETTINGS ----------
$("#install-deps-btn").addEventListener("click", async () => {
  const btn = $("#install-deps-btn"); btn.disabled = true;
  try {
    const res = await window.api.installDependencies();
    toast(tr("t.depsOk"), `${res.count}`, "ok");
    CONFIG = await window.api.getConfig(); updateSettingsUI();
  } catch (e) { toast(tr("t.depsFail"), e.message, "err"); }
  finally { btn.disabled = false; }
});
window.api.onDepProgress((d) => { $("#deps-progress-label").textContent = `${tr("installing")} (${d.current}/${d.total})`; });
$("#delete-all-btn").addEventListener("click", async () => {
  if (!confirm(tr("t.confirmDel"))) return;
  try {
    const res = await window.api.deleteAll();
    toast(tr("t.deleteDone"), `${res.removed}`, "info");
    CONFIG = await window.api.getConfig(); updateSettingsUI(); renderLib();
  } catch (e) { toast(tr("t.depsFail"), e.message, "err"); }
});

function renderLangButtons() {
  $("#lang-row").innerHTML = LANGS.map((l) => `<button class="lang-btn ${l.code === LANG ? "active" : ""}" data-lang="${l.code}"><span class="flag">${l.flag}</span> ${l.label}</button>`).join("");
  document.querySelectorAll(".lang-btn").forEach((b) => b.addEventListener("click", () => changeLang(b.dataset.lang)));
}
function changeLang(next) {
  if (next === LANG) return;
  const ov = $("#lang-overlay"); ov.classList.remove("hidden");
  $("#lang-text").textContent = tr("changing");
  const fill = $("#lang-bar-fill"), pct = $("#lang-pct");
  const started = Date.now();
  const iv = setInterval(() => {
    const p = Math.min(100, Math.round(((Date.now() - started) / 1100) * 100));
    fill.style.width = p + "%"; pct.textContent = p + "%";
    if (p >= 100) {
      clearInterval(iv);
      LANG = next; localStorage.setItem("lang", next);
      applyLang();
      setTimeout(() => ov.classList.add("hidden"), 250);
    }
  }, 60);
}
function applyLang() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = tr(el.getAttribute("data-i18n")); });
  $("#search").placeholder = tr("lib.searchPh");
  $("#search-bypass").placeholder = tr("bp.searchPh");
  const titles = { library: tr("nav.library"), bypass: tr("nav.bypass"), store: tr("nav.store"), settings: tr("nav.settings") };
  $("#view-title").textContent = titles[currentView];
  renderLangButtons();
  updateSteamUI(); updateSettingsUI();
  renderLib(); renderBypass(); renderStore();
}

function updateSettingsUI() {
  $("#deps-status").textContent = CONFIG.depsInstalled ? `${CONFIG.depsInstalled} ${tr("deps.count")}` : tr("deps.none");
  $("#device-code").textContent = CONFIG.deviceCode;
  $("#device-foot").textContent = CONFIG.deviceCode;
}
async function updateSteamUI() {
  const chk = await window.api.checkSteamPath();
  const s = $("#steam-status");
  if (chk.exists) { s.className = "steam-status ok"; s.textContent = tr("steam.ok"); }
  else { s.className = "steam-status bad"; s.textContent = tr("steam.bad"); }
}

// ---------- NAV ----------
document.querySelectorAll(".nav-item").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  currentView = b.dataset.view;
  const titles = { library: tr("nav.library"), bypass: tr("nav.bypass"), store: tr("nav.store"), settings: tr("nav.settings") };
  $("#view-title").textContent = titles[currentView];
  $("#view-library").classList.toggle("hidden", currentView !== "library");
  $("#view-bypass").classList.toggle("hidden", currentView !== "bypass");
  $("#view-store").classList.toggle("hidden", currentView !== "store");
  $("#view-settings").classList.toggle("hidden", currentView !== "settings");
  if (currentView === "store") loadStore();
  if (currentView === "bypass") loadBypass();
}));
$("#search").addEventListener("input", (e) => { searchTerm = e.target.value; renderLib(); });
$("#search-bypass").addEventListener("input", (e) => { bypassSearch = e.target.value; renderBypass(); });
$("#refresh-lib").addEventListener("click", loadLibrary);
$("#refresh-store").addEventListener("click", loadStore);
$("#refresh-bypass").addEventListener("click", loadBypass);

async function loadLibrary() {
  try {
    LIB = await apiGet(`/api/library?device_code=${encodeURIComponent(CONFIG.deviceCode)}`);
    try { BYPASS = await apiGet(`/api/bypasses`); } catch { /* keep old */ }
    renderLib();
  }
  catch (e) { toast(tr("t.serverDown"), CONFIG.apiBase, "err"); $("#empty-lib").classList.remove("hidden"); }
}
async function loadStore() {
  try {
    SETTINGS = await apiGet(`/api/settings`);
    STORE = await apiGet(`/api/store?device_code=${encodeURIComponent(CONFIG.deviceCode)}`);
    renderStore();
  } catch (e) { toast(tr("t.storeFail"), e.message, "err"); }
}
async function loadBypass() {
  try { BYPASS = await apiGet(`/api/bypasses`); renderBypass(); }
  catch (e) { toast(tr("t.storeFail"), e.message, "err"); $("#empty-bypass").classList.remove("hidden"); }
}

async function validateKey(key) {
  try {
    const r = await fetch(`${CONFIG.apiBase}/api/keys/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, hwid: CONFIG.deviceCode }) });
    return await r.json();
  } catch (e) { return { valid: false, reason: "network" }; }
}
function showGate(msg, blocked) {
  const g = $("#key-gate"); g.classList.remove("hidden");
  $("#key-gate-msg").textContent = msg || gt("enter");
  $("#key-device").textContent = CONFIG.deviceCode;
  $("#key-input").style.display = blocked ? "none" : "block";
  $("#key-submit").style.display = blocked ? "none" : "block";
  $("#key-quit").classList.toggle("hidden", !blocked);
}
$("#key-submit").addEventListener("click", async () => {
  const key = ($("#key-input").value || "").trim().toUpperCase();
  if (!key) return;
  $("#key-gate-msg").textContent = gt("checking");
  const res = await validateKey(key);
  if (res.valid) {
    await window.api.setKey(key);
    $("#key-gate").classList.add("hidden");
    applyLang();
    await loadLibrary();
  } else {
    $("#key-gate-msg").textContent = res.reason === "other_device" ? gt("other") : gt("invalid");
  }
});
$("#key-quit").addEventListener("click", () => window.api.quitApp());

async function gate() {
  const stored = await window.api.getKey();
  if (stored) {
    const res = await validateKey(stored);
    if (res.valid) return true;
    showGate(gt("blocked"), true);
    setTimeout(() => window.api.quitApp(), 5000);
    return false;
  }
  showGate("", false);
  return false;
}

async function init() {
  CONFIG = await window.api.getConfig();
  applyLang();
  const ok = await gate();
  if (!ok) return;
  await loadLibrary();
}
init();
