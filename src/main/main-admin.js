const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        // frame: false, // <-- No Admin a gente costuma deixar a barra do Windows, mas se quiser tirar, é só apagar as barrinhas "//" daqui
        icon: path.join(__dirname, '../assets/rayzer.png'), // Caminho corrigido voltando uma pasta (../)
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Força o aplicativo a abrir maximizado
    mainWindow.maximize(); 

    // Carrega o arquivo HTML do Admin
    mainWindow.loadFile(path.join(__dirname, '../renderer/admin/index.html'));

    // --- SISTEMA DOS BOTÕES CUSTOMIZADOS (CASO VOCÊ COLOQUE NO ADMIN) ---
    ipcMain.on('fechar-app', () => {
        mainWindow.close();
    });
    
    ipcMain.on('minimizar-app', () => {
        mainWindow.minimize();
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});