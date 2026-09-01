let CONFIG = { apiBase: "", steamPath: "" };
let ACTIVATIONS = {};
let GAMES = [];
let activeCat = "All";
let searchTerm = "";
const injecting = {};

const $ = (s) => document.querySelector(s);
const grid = $("#grid");

function toast(title, desc, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="t-title">${title}</div>${desc ? `<div class="t-desc">${desc}</div>` : ""}`;
  $("#toast-wrap").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3500);
}

async function apiGet(pathname) {
  const res = await fetch(`${CONFIG.apiBase}${pathname}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function coverUrl(url) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${CONFIG.apiBase}${url}`;
}

function renderCats() {
  const cats = ["All", ...new Set(GAMES.map((g) => g.category).filter(Boolean))];
  $("#cats").innerHTML = cats
    .map((c) => `<button class="cat ${c === activeCat ? "active" : ""}" data-cat="${c}">${c}</button>`)
    .join("");
  document.querySelectorAll(".cat").forEach((b) =>
    b.addEventListener("click", () => { activeCat = b.dataset.cat; renderCats(); renderGrid(); })
  );
}

function filtered() {
  return GAMES.filter((g) => {
    const catOk = activeCat === "All" || g.category === activeCat;
    const s = searchTerm.toLowerCase();
    const searchOk = !s || g.title.toLowerCase().includes(s) || g.app_id.includes(s);
    return catOk && searchOk;
  });
}

function renderGrid() {
  const list = filtered();
  $("#empty").classList.toggle("hidden", list.length > 0);
  grid.innerHTML = list.map(cardHtml).join("");
  list.forEach((g) => {
    const root = grid.querySelector(`[data-card="${g.id}"]`);
    if (!root) return;
    const btn = root.querySelector(".activate");
    if (btn) btn.addEventListener("click", () => activate(g));
    const dbtn = root.querySelector(".deactivate");
    if (dbtn) dbtn.addEventListener("click", () => deactivate(g));
  });
}

function cardHtml(g) {
  const dll = g.files.filter((f) => f.type === "dll").length;
  const lua = g.files.filter((f) => f.type === "lua").length;
  const isActive = !!ACTIVATIONS[g.id];
  const busy = injecting[g.id];
  const cover = coverUrl(g.cover_url);
  return `
  <div class="gcard" data-card="${g.id}">
    <div class="cover">
      ${cover ? `<img src="${cover}" alt="${g.title}" />` : ""}
      <span class="appid">APPID ${g.app_id}</span>
      ${isActive ? `<span class="badge-active">● Active</span>` : ""}
    </div>
    <div class="gbody">
      <div class="gtitle">${g.title}</div>
      <div class="gcat">${g.category || "Uncategorized"}</div>
      <div class="counts">
        <span class="c-dll">▣ ${dll} DLL</span>
        <span class="c-lua">‹/› ${lua} LUA</span>
      </div>
      <div class="actions">
        ${isActive
          ? `<button class="btn success full deactivate" data-testid="deactivate-${g.app_id}">✓ Activated — Remove</button>`
          : `<button class="btn full activate" data-testid="activate-${g.app_id}" ${busy ? "disabled" : ""}>${busy ? "Injecting…" : "⚡ Activate"}</button>`}
      </div>
      <div class="progress hidden" data-progress="${g.id}"><div></div></div>
      <div class="progress-label hidden" data-plabel="${g.id}"></div>
    </div>
  </div>`;
}

async function activate(g) {
  if (injecting[g.id]) return;
  injecting[g.id] = true;
  renderGrid();
  const bar = grid.querySelector(`[data-progress="${g.id}"]`);
  const label = grid.querySelector(`[data-plabel="${g.id}"]`);
  if (bar) bar.classList.remove("hidden");
  if (label) label.classList.remove("hidden");
  try {
    const res = await window.api.activateGame(g);
    toast("Activated: " + g.title, `${res.files.length} file(s) injected into Steam`, "ok");
    ACTIVATIONS = await window.api.getActivations();
  } catch (e) {
    toast("Activation failed", e.message, "err");
  } finally {
    injecting[g.id] = false;
    renderGrid();
  }
}

async function deactivate(g) {
  try {
    const res = await window.api.deactivateGame(g.id);
    toast("Deactivated: " + g.title, `Removed ${res.removed.length} file(s)`, "info");
    ACTIVATIONS = await window.api.getActivations();
    renderGrid();
  } catch (e) {
    toast("Deactivate failed", e.message, "err");
  }
}

window.api.onProgress((data) => {
  const bar = grid.querySelector(`[data-progress="${data.gameId}"] > div`);
  const label = grid.querySelector(`[data-plabel="${data.gameId}"]`);
  if (bar) bar.style.width = `${Math.round((data.current / data.total) * 100)}%`;
  if (label) label.textContent = `→ ${data.filename} (${data.current}/${data.total})`;
});

// ---------- Nav ----------
document.querySelectorAll(".nav-item").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const view = b.dataset.view;
    $("#view-library").classList.toggle("hidden", view !== "library");
    $("#view-settings").classList.toggle("hidden", view !== "settings");
  })
);

$("#search").addEventListener("input", (e) => { searchTerm = e.target.value; renderGrid(); });
$("#refresh-btn").addEventListener("click", loadGames);

$("#save-path-btn").addEventListener("click", async () => {
  const p = $("#steam-path-input").value.trim();
  CONFIG.steamPath = await window.api.setSteamPath(p);
  toast("Steam path saved", CONFIG.steamPath, "ok");
  refreshSteamUI();
});

async function refreshSteamUI() {
  $("#steam-path-label").textContent = CONFIG.steamPath;
  $("#steam-path-input").value = CONFIG.steamPath;
  $("#api-base").value = CONFIG.apiBase;
  $("#t-dll").textContent = CONFIG.steamPath + "\\";
  $("#t-lua").textContent = CONFIG.steamPath + "\\config\\lua\\";
  const chk = await window.api.checkSteamPath();
  const s = $("#steam-status");
  const pc = $("#path-check");
  if (chk.exists) {
    s.className = "steam-status ok"; s.textContent = "● Steam folder found";
    pc.className = "path-check ok"; pc.textContent = "✓ Directory exists";
  } else {
    s.className = "steam-status bad"; s.textContent = "▲ Steam folder not found";
    pc.className = "path-check bad"; pc.textContent = "▲ Directory not found — set the correct path.";
  }
}

async function loadGames() {
  try {
    GAMES = await apiGet("/api/games");
    ACTIVATIONS = await window.api.getActivations();
    renderCats();
    renderGrid();
  } catch (e) {
    toast("Could not reach server", `${CONFIG.apiBase} — ${e.message}`, "err");
    $("#empty").classList.remove("hidden");
    $("#empty").textContent = "Cannot reach server. Check apiBase in config.json.";
  }
}

async function init() {
  CONFIG = await window.api.getConfig();
  await refreshSteamUI();
  await loadGames();
}
init();
