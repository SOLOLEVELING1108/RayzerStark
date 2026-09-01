# Steam Config Patcher — Desktop Client (Windows)

This is the Windows desktop app that actually copies your game files into the Steam folder.
It connects to the same server as the web console, downloads each game's files when you click
**Activate**, and places them in the correct locations:

- **DLL dependencies** → `C:\Program Files (x86)\Steam\`
- **`.lua` scripts** → `C:\Program Files (x86)\Steam\config\lua\`

Clicking **Remove** (deactivate) deletes the files that were injected for that game.

## Requirements
- Windows 10/11
- [Node.js](https://nodejs.org) 18+ (only needed to build; the final `.exe` is standalone)

## Configure
Edit `config.json`:
```json
{
  "apiBase": "https://game-config-patcher.preview.emergentagent.com",
  "steamPath": "C:\\Program Files (x86)\\Steam"
}
```
- `apiBase` — the server URL (shown in the web app under **Settings**).
- `steamPath` — default Steam location (can also be changed inside the app under Settings).

## Run in development
```bash
cd desktop
npm install
npm start
```

## Build the Windows installer / portable .exe
```bash
npm run build:win        # NSIS installer + portable, output in dist/
# or
npm run build:portable   # single portable .exe
```
The built files appear in `desktop/dist/`.

## How it works
1. The app loads the game library from `GET {apiBase}/api/games`.
2. On **Activate**, it calls `GET {apiBase}/api/games/{id}/package` to get the file manifest.
3. Each file is downloaded from `GET {apiBase}/api/files/download?path=...` and written to its target folder.
4. Activated games and the exact files written are recorded locally so **Remove** can undo them.

> Add games and upload their `.dll` / `.lua` files from the web console (Add Game → upload files).
