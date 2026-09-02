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

## Update (2026-09-01) — Supabase + Admin/Client split
- Migrated storage+catalog to the user's SUPABASE (Postgres tables + Storage bucket `game-files`).
  - Tables: games, dependencies, entitlements, purchase_requests, app_settings (schema in backend/supabase_schema.sql — run once in Supabase SQL Editor).
  - backend/supa.py uses a THREAD-LOCAL Supabase client (fixes concurrency 500s with FastAPI threadpool `def` routes).
- Two apps now:
  - ADMIN (this web app): Library (with Public/Store badges + price), Add/Edit Game (toggles is_public/in_store + price, cover file upload works in edit via /games/{id}/cover, .lua uploads), Dependencies (global DLLs), Orders (pending purchases + Liberar/Rejeitar + nav badge), Settings (Pix editable).
  - CLIENT (Electron /app/desktop): Biblioteca (por device_code), Loja (Pix + envio de comprovante), Configurações (Instalar dependências → DLLs na raiz Steam; Excluir todos os jogos → apaga arquivos injetados). Device code auto-gerado local.
- Purchase flow (simulated): client uploads receipt with device_code -> admin approves -> entitlement -> game shows in that device's Library. Public games are free for all devices.
- Pix seeded: CPF 08624582504, Wdson de Jesus Souza.
- Tests: backend_test.py 26/26 (serial + xdist parallel), test_concurrency.py green 3x. Electron client not auto-tested (Windows-only).

## Known / backlog
- P1: Ship prebuilt Windows .exe.
- P2: No auth — /api/settings (Pix), game mutations, dependencies, purchases/approve are publicly writable. Add admin auth before real use (money flow risk).
- P2: Pydantic models for PUT /games and PUT /settings; duplicate app_id validation.
- P3: GameManage loading skeleton; badge spacing when Public+Store.

## Update (2026-09-01) — Admin auth + Windows builds
- Windows .exe builds (Electron, portable, built on ARM/Linux with signAndEditExecutable:false):
  - Client: /app/desktop/dist/SteamConfigPatcher-win-x64.zip  (served: GET /api/client-build/download)
  - Admin:  /app/admin-desktop (loads hosted admin URL) -> ConfigPatcherAdmin-win-x64.zip (GET /api/admin-build/download)
  - Download buttons added in Admin -> Settings.
- Admin auth: JWT Bearer, single admin from env (ADMIN_EMAIL/ADMIN_PASSWORD, bcrypt hash at startup, no DB table). backend/auth.py.
  - POST /api/auth/login, GET /api/auth/me. Protected (Depends require_admin): games create/update/delete, lua add/remove, cover, dependencies add/delete, settings PUT, purchases list/count/approve/reject.
  - Public (client app + store): GET games/categories/store/library/entitlements/package, GET settings (pix), POST purchases, dependencies list, files download, build downloads.
  - Frontend: /login page, ProtectedRoute, axios interceptor attaches Bearer + redirects to /login on 401, Sair (logout) in sidebar. Token in localStorage 'admin_token'.
  - Admin desktop app shows the login too (loads hosted URL live — no rebuild needed).
- Credentials in /app/memory/test_credentials.md.

## Update (2026-09-01) — Rebrand + i18n + Bypass + HWID
- Rebrand to "Rayzer Stark Game" (both apps): custom generated logo at frontend/public/logo.png, desktop/renderer/logo.png, and build/icon.png for both electron apps. Removed "Supabase" wording from admin UI.
- i18n PT/EN/ES: admin frontend/src/i18n.js (I18nProvider/useI18n, loading overlay, lang buttons in Settings, default pt). Client has its own vanilla i18n in renderer.js (data-i18n + tr()) with loading overlay.
- Client UX cleanup: removed all path displays and any .lua mention from Library/Store; Settings shows only Install dependencies + Delete all + Device code (no paths); Steam status shows found/not-found without path.
- HWID device code: client derives a stable PC-XXXXXXXX from node-machine-id (Windows MachineGUID), fallback to persisted random.
- BYPASS feature: Supabase table `bypasses` (SQL in backend/supabase_bypass.sql). Backend endpoints: GET /api/bypasses (public), GET/{id}, POST (admin, cover+file), PUT, POST /{id}/file, POST /{id}/cover, DELETE (soft). Admin pages BypassLibrary + BypassManage (nav 'Bypass'). Client 'Bypass' tab: Download button saves the file to the Windows Downloads folder (main.js download-bypass → app.getPath('downloads')). Open to everyone (no entitlement).
- Windows builds rebuilt: RayzerStarkGame-Client-win-x64.zip + RayzerStarkGame-Admin-win-x64.zip (served by /api/client-build/download and /api/admin-build/download). Backend paths updated.
- Tests: iteration_3 backend 77/77 (auth+bypass+legacy), frontend all flows pass. Fixed GameManage i18n leftovers + BypassManage error toast. Cleaned 13 residual test purchase_requests.

## Update (2026-09-02) — Bypass large-file fix + Access Keys
- Bypass upload bug: files >~50MB failed with 500 (Supabase free-tier Storage cap). Now returns a clear HTTP 400 message; admins can instead paste an EXTERNAL file URL (file_url) on create/edit — works for any size. Client download supports {url} or {path}. Frontend now surfaces the backend 400 detail.
- ACCESS KEYS (license): Supabase table access_keys (SQL in backend/supabase_keys.sql). Admin: POST/GET/DELETE /api/keys, POST /api/keys/{id}/reset (all admin-JWT). Public POST /api/keys/validate {key,hwid}: first PC binds hwid (activated), same PC ok, other PC => invalid(other_device). Admin Keys page (nav 'Keys'): generate/copy/reset/delete.
- Client key gate: on startup validates stored key + deviceCode(HWID). No key => activation screen; invalid/other-PC => blocked message + auto-close (5s). Key stored locally by main process.
- Windows client rebuilt (RayzerStarkGame-Client-win-x64.zip) with key gate + bypass URL/HWID.
- Tests iteration_4: backend 95/95, frontend flows pass. Known backlog: no login brute-force lockout; keys delete/reset no 404 on missing; consider splitting server.py into routers.
