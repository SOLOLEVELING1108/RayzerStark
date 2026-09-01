# Steam Config Patcher — PRD

## Problem statement
User (PT-BR) needs an app to inject game files into the Steam folder. DLLs go to
`C:\Program Files (x86)\Steam` (root); `.lua` files (named with the game's Steam App ID)
go to `C:\Program Files (x86)\Steam\config\lua`. User picks a game by ID, clicks Activate,
and the app fetches that game's files from a server and drops them in the right folders.

## User choices
- Platform: Windows, Electron desktop client
- Files stored on server/cloud, downloaded on Activate (Emergent object storage)
- Steam path fixed: C:\Program Files (x86)\Steam (also editable in the desktop app Settings)
- Visual interface (game covers, search, categories)

## Architecture
- Backend: FastAPI + MongoDB + Emergent object storage (backend/server.py, backend/storage.py)
  - Games CRUD, file upload (dll|lua), injection package manifest, file download
  - App name / storage prefix: game-config-patcher
- Web console (React, /app/frontend): admin + library preview (add games, upload DLL/.lua/cover, browse)
- Desktop client (Electron, /app/desktop): the actual injector — downloads a game's files and writes
  DLLs to Steam root, .lua to Steam\config\lua; records activations locally so they can be removed.

## Implemented (2026-09-01)
- Backend: /api/games (list/search/category), /api/categories, CRUD, /api/games/{id}/files (add/remove),
  /api/games/{id}/package, /api/files/download (path-scoped to app prefix). 16/16 backend tests pass.
- Seed: 4 sample games each with a generated {app_id}.lua in object storage.
- Web console: tactical dark launcher UI — library grid, search, category filter, Simulate Inject,
  Add/Edit game with file uploads, Settings (paths + apiBase + build instructions).
- Electron app: main/preload/renderer, config.json, README + build scripts (build:win / build:portable).
- Fixes: cover no longer wiped on edit; clipboard copy guarded; file-size display; download path scoping.

## No auth (not requested).

## Backlog / next
- P1: Cover replacement while editing (multipart PUT or /games/{id}/cover endpoint).
- P1: Ship prebuilt Windows .exe (currently user builds via npm run build:win).
- P2: app_id uniqueness validation; responsive sidebar collapse on tablet.
- P2: Admin auth if the server becomes public.
