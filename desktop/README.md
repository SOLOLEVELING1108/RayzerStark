# Steam Config Patcher — App do Cliente (Windows / Electron)

App desktop que o **cliente** usa. Ele conecta no mesmo servidor (Supabase via backend) e tem 3 abas:

- **Biblioteca**: jogos liberados pra este dispositivo (comprados + os marcados como públicos/grátis). Clicar **Ativar** baixa os `.lua` do jogo e joga em `C:\Program Files (x86)\Steam\config\lua\`. **Remover** apaga esses arquivos.
- **Loja**: jogos à venda. Clicar **Comprar** mostra seu **Pix** (chave/titular), o cliente anexa o **comprovante** e envia. Fica "aguardando liberação" até o admin aprovar.
- **Configurações**:
  - **Instalar dependências**: baixa e instala as DLLs na raiz `C:\Program Files (x86)\Steam\`.
  - **Excluir todos os jogos**: remove permanentemente deste PC todos os arquivos injetados (DLLs + `.lua`).
  - **Código do dispositivo**: um código único (ex: `PC-1A2B3C4D`) que o cliente envia junto do comprovante pra você liberar no Admin.

## Requisitos
- Windows 10/11
- Node.js 18+ (só pra buildar; o `.exe` final é standalone)

## Configurar
Edite `config.json`:
```json
{
  "apiBase": "https://game-config-patcher.preview.emergentagent.com",
  "steamPath": "C:\\Program Files (x86)\\Steam"
}
```

## Rodar em desenvolvimento
```bash
cd desktop
npm install
npm start
```

## Gerar o .exe do Windows
```bash
npm run build:win        # instalador + portátil em dist/
# ou
npm run build:portable   # .exe portátil único
```

## Fluxo de compra (loja simulada)
1. Cliente clica **Comprar** → vê o Pix e envia o **comprovante** (com o **código do dispositivo**).
2. No **Admin → Orders** chega o pedido pendente (com contador/badge). Você confere o comprovante e clica **Liberar**.
3. O jogo passa a aparecer na **Biblioteca** do dispositivo do cliente, pronto pra Ativar.
