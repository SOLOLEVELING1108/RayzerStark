const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");

function adminUrl() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8")).adminUrl;
  } catch {
    return "https://game-config-patcher.preview.emergentagent.com";
  }
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#08090E",
    autoHideMenuBar: true,
    title: "Rayzer Stark Game — Admin",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  win.loadURL(adminUrl());

  // Open target=_blank / external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Simple offline fallback
  win.webContents.on("did-fail-load", (_e, code, desc) => {
    if (code === -3) return; // aborted, ignore
    win.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<body style="background:#08090E;color:#e2e8f0;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0">
             <div style="text-align:center">
               <h2>Sem conexão com o servidor</h2>
               <p style="color:#94a3b8">${desc || "Verifique sua internet e tente de novo."}</p>
               <button onclick="location.reload()" style="margin-top:12px;padding:10px 18px;border:0;border-radius:10px;background:#06B6D4;color:#001014;font-weight:700;cursor:pointer">Tentar novamente</button>
             </div>
           </body>`
        )
    );
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
