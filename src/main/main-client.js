const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const axios = require('axios');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1024,
        minHeight: 768,
        frame: false, // Esconde a barra padrão do Windows
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        },
        icon: path.join(__dirname, '../../assets/rayzer.ico') // <-- ÍCONE ATUALIZADO
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/client/index.html'));

    // ==========================================
    // TELA CHEIA AUTOMÁTICA
    // ==========================================
    mainWindow.maximize();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // CHAMA A VERIFICAÇÃO DE ATUALIZAÇÕES ASSIM QUE A TELA RENDERIZAR
    mainWindow.webContents.on('did-finish-load', () => {
        // Se estiver testando no PC (modo dev), não atualiza pra não bugar o terminal
        if (!app.isPackaged) {
            setTimeout(() => {
                mainWindow.webContents.send('update-status', 'ok_sem_atualizacao');
            }, 1500);
        } else {
            verificarAtualizacoes(mainWindow);
        }
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// ==========================================
// CONTROLES DA BARRA DE TÍTULO
// ==========================================
ipcMain.on('fechar-app', () => {
    app.quit();
});

ipcMain.on('minimizar-app', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximizar-app', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.restore();
        } else {
            mainWindow.maximize();
        }
    }
});

// ==========================================
// COMUNICAÇÃO DE HARDWARE (HWID)
// ==========================================
ipcMain.on('get-pc-info', (event) => {
    const hostname = os.hostname();
    
    // Puxa o serial da Placa Mãe para travar a Key
    exec('wmic csproduct get uuid', (err, stdout) => {
        let hwid = 'FALHA-HWID';
        if (!err) {
            const lines = stdout.split('\n');
            if (lines.length > 1) {
                hwid = lines[1].trim();
            }
        }
        event.reply('pc-info-reply', { hwid: hwid, hostname: hostname });
    });
});

// ==========================================
// INSTALADOR DE DEPENDÊNCIAS (COM AXIOS)
// ==========================================
function obterCaminhoSteamMain() {
    try {
        const output = execSync('reg query HKCU\\Software\\Valve\\Steam /v SteamPath', { encoding: 'utf8' });
        const match = output.match(/REG_SZ\s+([^\r\n]+)/);
        if (match && match[1]) {
            return match[1].trim().replace(/\//g, '\\');
        }
    } catch (e) {
        console.log("Steam path não achado, usando padrão");
    }
    return "C:\\Program Files (x86)\\Steam";
}

ipcMain.on('iniciar-instalacao-deps', async (event, listaDownloads) => {
    const steamPath = obterCaminhoSteamMain();
    
    try {
        // ---------------------------------------------------------
        // 1. LIMPEZA DA PASTA LUA ANTIGA E CRIAÇÃO DA STPLUG-IN
        // ---------------------------------------------------------
        const configPath = path.join(steamPath, 'config');
        const oldLuaPath = path.join(configPath, 'lua');
        const newPluginPath = path.join(configPath, 'stplug-in');

        // Se a pasta config não existir, o sistema cria pra evitar bugs
        if (!fs.existsSync(configPath)) {
            fs.mkdirSync(configPath, { recursive: true });
        }

        // Se a pasta 'lua' antiga existir no PC do cliente, exclui ela inteira!
        if (fs.existsSync(oldLuaPath)) {
            try {
                fs.rmSync(oldLuaPath, { recursive: true, force: true });
                console.log("Pasta lua antiga removida com sucesso.");
            } catch (e) {
                console.error("Erro ao excluir pasta lua:", e);
            }
        }

        // Cria a nova pasta 'stplug-in' (se ela ainda não existir)
        if (!fs.existsSync(newPluginPath)) {
            fs.mkdirSync(newPluginPath, { recursive: true });
            console.log("Pasta stplug-in criada com sucesso.");
        }

        // ---------------------------------------------------------
        // 2. DOWNLOAD DAS DEPENDÊNCIAS NA RAIZ DA STEAM
        // ---------------------------------------------------------
        for (let i = 0; i < listaDownloads.length; i++) {
            const dep = listaDownloads[i];
            
            // Avisa o botão do HTML que começou a baixar
            event.reply('deps-status', `⏳ Baixando ${i + 1}/${listaDownloads.length}...`);
            
            // Faz o download via Axios
            const response = await axios({
                method: 'get',
                url: dep.url,
                responseType: 'arraybuffer'
            });
            
            // Salva o arquivo caindo direto na raiz da Steam
            const destPath = path.join(steamPath, dep.nome);
            fs.writeFileSync(destPath, Buffer.from(response.data));
        }
        
        // Quando terminar todos, avisa o HTML para reiniciar a Steam
        event.reply('deps-status', 'FINALIZADO');
        
    } catch (err) {
        console.error("Erro ao instalar dependências:", err);
        // <-- ATUALIZADO COM O NOSSO PEGADOR DE ERROS (ERRO|)
        event.reply('deps-status', 'ERRO|' + err.message); 
    }
});

// ==========================================
// SISTEMA DE ATUALIZAÇÃO AUTOMÁTICA (MANUAL VIA AXIOS)
// ==========================================
async function verificarAtualizacoes(window) {
    try {
        const versaoAtual = app.getVersion();
        
        // <-- ATUALIZADO PARA O NOVO REPOSITÓRIO GITHUB!
        const repo = 'SOLOLEVELING1108/RayzerStark'; 
        const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

        const response = await axios.get(apiUrl);
        const latestRelease = response.data;
        const versaoGitHub = latestRelease.tag_name.replace('v', '');

        if (versaoGitHub !== versaoAtual && latestRelease.assets.length > 0) {
            const assetExe = latestRelease.assets.find(a => a.name.endsWith('.exe'));
            
            if (assetExe) {
                window.webContents.send('update-status', `BAIXANDO ATUALIZAÇÃO ${versaoGitHub}...`);
                const tempPath = path.join(os.tmpdir(), assetExe.name);
                
                const downloadRes = await axios({
                    method: 'get',
                    url: assetExe.browser_download_url,
                    responseType: 'arraybuffer'
                });
                
                fs.writeFileSync(tempPath, Buffer.from(downloadRes.data));
                window.webContents.send('update-status', 'INICIANDO INSTALADOR...');
                
                setTimeout(() => {
                    const { spawn } = require('child_process');
                    spawn(tempPath, [], { detached: true, stdio: 'ignore' }).unref();
                    app.quit();
                }, 2000);
            } else {
                window.webContents.send('update-status', 'ok_sem_atualizacao');
            }
        } else {
            window.webContents.send('update-status', 'ok_sem_atualizacao');
        }
    } catch (e) {
        console.error("Erro na verificação do GitHub:", e.message);
        // Se der erro (ex: sem net ou sem release lá), ele fecha a tela preta e segue o jogo.
        window.webContents.send('update-status', 'ok_sem_atualizacao');
    }
}