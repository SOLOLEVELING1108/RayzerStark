from fastapi import FastAPI, APIRouter, UploadFile, File, Form, Query, HTTPException, Depends
from fastapi.responses import Response, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import supa
import auth

app = FastAPI(title="Game Config Patcher API")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

MIME = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
    "webp": "image/webp", "dll": "application/octet-stream", "lua": "text/plain",
    "txt": "text/plain", "pdf": "application/pdf",
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def ext_of(name, default="bin"):
    return (name.rsplit(".", 1)[-1] if "." in name else default).lower()


def rows(res):
    return res.data or []


def one(res):
    d = res.data or []
    return d[0] if d else None


# ============ GAMES ============
@api_router.get("/")
def root():
    return {"message": "Game Config Patcher API (Supabase)", "schema_ready": supa.schema_ready()}


# ============ AUTH (single admin) ============
@api_router.post("/auth/login")
def login(payload: dict):
    email = payload.get("email", "")
    password = payload.get("password", "")
    if not auth.verify_credentials(email, password):
        raise HTTPException(401, "E-mail ou senha inválidos")
    return {"token": auth.create_token(auth.ADMIN_EMAIL), "email": auth.ADMIN_EMAIL, "role": "admin"}


@api_router.get("/auth/me")
def me(admin=Depends(auth.require_admin)):
    return admin


@api_router.get("/games")
def list_games(search: str | None = None, category: str | None = None):
    q = supa.t("games").select("*").eq("is_deleted", False).order("created_at", desc=True)
    if category and category != "All":
        q = q.eq("category", category)
    data = rows(q.execute())
    if search:
        s = search.lower()
        data = [g for g in data if s in g["title"].lower() or s in str(g["app_id"]).lower()]
    return data


@api_router.get("/categories")
def categories():
    data = rows(supa.t("games").select("category").eq("is_deleted", False).execute())
    return sorted({g["category"] for g in data if g.get("category")})


@api_router.get("/games/{game_id}")
def get_game(game_id: str):
    g = one(supa.t("games").select("*").eq("id", game_id).eq("is_deleted", False).execute())
    if not g:
        raise HTTPException(404, "Game not found")
    return g


@api_router.post("/games")
async def create_game(
    title: str = Form(...),
    app_id: str = Form(...),
    category: str = Form("Uncategorized"),
    description: str = Form(""),
    cover_url: str = Form(""),
    in_store: bool = Form(False),
    price: float = Form(0),
    is_public: bool = Form(False),
    cover: UploadFile | None = File(None),
    admin: dict = Depends(auth.require_admin),
):
    gid = str(uuid.uuid4())
    final_cover = cover_url
    if cover is not None:
        ext = ext_of(cover.filename, "png")
        path = f"covers/{gid}.{ext}"
        supa.upload(path, await cover.read(), MIME.get(ext, "image/png"))
        final_cover = f"/api/files/download?path={path}"
    row = {
        "id": gid, "app_id": app_id, "title": title, "category": category,
        "description": description, "cover_url": final_cover, "lua_files": [],
        "in_store": in_store, "price": price, "is_public": is_public,
        "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso(),
    }
    supa.t("games").insert(row).execute()
    return row


@api_router.put("/games/{game_id}")
async def update_game(game_id: str, payload: dict, admin: dict = Depends(auth.require_admin)):
    allowed = {"app_id", "title", "category", "description", "cover_url", "in_store", "price", "is_public"}
    updates = {k: v for k, v in payload.items() if k in allowed and v is not None}
    if updates.get("cover_url", None) == "":
        updates.pop("cover_url")
    updates["updated_at"] = now_iso()
    supa.t("games").update(updates).eq("id", game_id).execute()
    return get_game(game_id)


@api_router.delete("/games/{game_id}")
def delete_game(game_id: str, admin: dict = Depends(auth.require_admin)):
    supa.t("games").update({"is_deleted": True}).eq("id", game_id).execute()
    return {"ok": True}


@api_router.post("/games/{game_id}/lua")
async def add_lua(game_id: str, file: UploadFile = File(...), admin: dict = Depends(auth.require_admin)):
    g = get_game(game_id)
    fid = str(uuid.uuid4())
    ext = ext_of(file.filename, "lua")
    path = f"lua/{game_id}/{fid}.{ext}"
    data = await file.read()
    supa.upload(path, data, MIME.get(ext, "text/plain"))
    entry = {"id": fid, "filename": file.filename, "path": path, "size": len(data)}
    lua = g.get("lua_files") or []
    lua.append(entry)
    supa.t("games").update({"lua_files": lua, "updated_at": now_iso()}).eq("id", game_id).execute()
    return get_game(game_id)


@api_router.delete("/games/{game_id}/lua/{file_id}")
def remove_lua(game_id: str, file_id: str, admin: dict = Depends(auth.require_admin)):
    g = get_game(game_id)
    lua = g.get("lua_files") or []
    keep = [f for f in lua if f["id"] != file_id]
    drop = next((f for f in lua if f["id"] == file_id), None)
    if drop:
        supa.remove(drop["path"])
    supa.t("games").update({"lua_files": keep, "updated_at": now_iso()}).eq("id", game_id).execute()
    return get_game(game_id)


@api_router.post("/games/{game_id}/cover")
async def update_cover(game_id: str, cover: UploadFile = File(...), admin: dict = Depends(auth.require_admin)):
    get_game(game_id)
    ext = ext_of(cover.filename, "png")
    path = f"covers/{game_id}.{ext}"
    supa.upload(path, await cover.read(), MIME.get(ext, "image/png"))
    url = f"/api/files/download?path={path}"
    supa.t("games").update({"cover_url": url, "updated_at": now_iso()}).eq("id", game_id).execute()
    return get_game(game_id)


# ============ DEPENDENCIES (global DLLs) ============
@api_router.get("/dependencies")
def list_deps():
    return rows(supa.t("dependencies").select("*").eq("is_deleted", False).order("created_at").execute())


@api_router.post("/dependencies")
async def add_dep(file: UploadFile = File(...), admin: dict = Depends(auth.require_admin)):
    did = str(uuid.uuid4())
    ext = ext_of(file.filename, "dll")
    path = f"deps/{did}.{ext}"
    data = await file.read()
    supa.upload(path, data, MIME.get(ext, "application/octet-stream"))
    row = {"id": did, "filename": file.filename, "path": path, "size": len(data),
           "is_deleted": False, "created_at": now_iso()}
    supa.t("dependencies").insert(row).execute()
    return row


@api_router.delete("/dependencies/{dep_id}")
def delete_dep(dep_id: str, admin: dict = Depends(auth.require_admin)):
    d = one(supa.t("dependencies").select("*").eq("id", dep_id).execute())
    if d:
        supa.remove(d["path"])
    supa.t("dependencies").update({"is_deleted": True}).eq("id", dep_id).execute()
    return {"ok": True}


# ============ SETTINGS / PIX ============
@api_router.get("/settings")
def get_settings():
    s = one(supa.t("app_settings").select("*").eq("id", 1).execute())
    return s or {"id": 1, "pix_key": "", "pix_type": "", "pix_holder": ""}


@api_router.put("/settings")
def update_settings(payload: dict, admin: dict = Depends(auth.require_admin)):
    updates = {k: v for k, v in payload.items() if k in {"pix_key", "pix_type", "pix_holder"}}
    supa.t("app_settings").update(updates).eq("id", 1).execute()
    return get_settings()


# ============ STORE / PURCHASES ============
@api_router.get("/store")
def store(device_code: str | None = None):
    games = rows(supa.t("games").select("*").eq("is_deleted", False).eq("in_store", True).order("created_at", desc=True).execute())
    owned = set()
    pending = set()
    if device_code:
        owned = {e["game_id"] for e in rows(supa.t("entitlements").select("game_id").eq("device_code", device_code).execute())}
        pending = {p["game_id"] for p in rows(supa.t("purchase_requests").select("game_id").eq("device_code", device_code).eq("status", "pending").execute())}
    for g in games:
        g["owned"] = g["id"] in owned
        g["pending"] = g["id"] in pending
    return games


@api_router.post("/purchases")
async def create_purchase(
    device_code: str = Form(...),
    device_name: str = Form(""),
    game_id: str = Form(...),
    receipt: UploadFile = File(...),
):
    pid = str(uuid.uuid4())
    ext = ext_of(receipt.filename, "png")
    path = f"receipts/{device_code}/{pid}.{ext}"
    supa.upload(path, await receipt.read(), MIME.get(ext, "image/png"))
    row = {"id": pid, "device_code": device_code, "device_name": device_name, "game_id": game_id,
           "receipt_path": path, "status": "pending", "created_at": now_iso()}
    supa.t("purchase_requests").insert(row).execute()
    return row


@api_router.get("/purchases")
def list_purchases(status: str | None = None, admin: dict = Depends(auth.require_admin)):
    q = supa.t("purchase_requests").select("*").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    data = rows(q.execute())
    gmap = {g["id"]: g for g in rows(supa.t("games").select("id,title,app_id,cover_url,price").execute())}
    for p in data:
        g = gmap.get(p["game_id"], {})
        p["game_title"] = g.get("title", "?")
        p["game_app_id"] = g.get("app_id", "")
        p["game_price"] = g.get("price", 0)
        p["receipt_url"] = f"/api/files/download?path={p['receipt_path']}" if p.get("receipt_path") else ""
    return data


@api_router.get("/purchases/count")
def purchases_count(admin: dict = Depends(auth.require_admin)):
    data = rows(supa.t("purchase_requests").select("id").eq("status", "pending").execute())
    return {"pending": len(data)}


@api_router.post("/purchases/{pid}/approve")
def approve_purchase(pid: str, admin: dict = Depends(auth.require_admin)):
    p = one(supa.t("purchase_requests").select("*").eq("id", pid).execute())
    if not p:
        raise HTTPException(404, "Purchase not found")
    existing = rows(supa.t("entitlements").select("id").eq("device_code", p["device_code"]).eq("game_id", p["game_id"]).execute())
    if not existing:
        supa.t("entitlements").insert({"id": str(uuid.uuid4()), "device_code": p["device_code"],
                                       "game_id": p["game_id"], "created_at": now_iso()}).execute()
    supa.t("purchase_requests").update({"status": "approved", "resolved_at": now_iso()}).eq("id", pid).execute()
    return {"ok": True}


@api_router.post("/purchases/{pid}/reject")
def reject_purchase(pid: str, admin: dict = Depends(auth.require_admin)):
    supa.t("purchase_requests").update({"status": "rejected", "resolved_at": now_iso()}).eq("id", pid).execute()
    return {"ok": True}


# ============ CLIENT LIBRARY ============
@api_router.get("/library")
def library(device_code: str = Query(...)):
    owned = {e["game_id"] for e in rows(supa.t("entitlements").select("game_id").eq("device_code", device_code).execute())}
    games = rows(supa.t("games").select("*").eq("is_deleted", False).order("created_at", desc=True).execute())
    out = []
    for g in games:
        if g.get("is_public") or g["id"] in owned:
            g["source"] = "public" if g.get("is_public") and g["id"] not in owned else "owned"
            out.append(g)
    return out


@api_router.get("/games/{game_id}/package")
def package(game_id: str, device_code: str | None = None):
    g = get_game(game_id)
    if not g.get("is_public"):
        if not device_code:
            raise HTTPException(403, "Not entitled")
        ent = rows(supa.t("entitlements").select("id").eq("device_code", device_code).eq("game_id", game_id).execute())
        if not ent:
            raise HTTPException(403, "Not entitled")
    files = [{"id": f["id"], "type": "lua", "filename": f["filename"],
              "target": "steam_config_lua", "download_path": f["path"], "size": f.get("size", 0)}
             for f in (g.get("lua_files") or [])]
    return {"game_id": g["id"], "app_id": g["app_id"], "title": g["title"], "files": files}


# ============ FILES ============
@api_router.get("/files/download")
def download_file(path: str = Query(...)):
    if not path or ".." in path:
        raise HTTPException(400, "Invalid path")
    try:
        data = supa.download(path)
    except Exception as e:
        raise HTTPException(404, f"File not found: {e}")
    ext = ext_of(path, "bin")
    return Response(content=data, media_type=MIME.get(ext, "application/octet-stream"))


# ============ CLIENT BUILD (Windows .exe download) ============
CLIENT_BUILD = Path("/app/desktop/dist/SteamConfigPatcher-win-x64.zip")
ADMIN_BUILD = Path("/app/admin-desktop/dist/ConfigPatcherAdmin-win-x64.zip")


@api_router.get("/client-build/info")
def client_build_info():
    if CLIENT_BUILD.exists():
        return {"available": True, "size": CLIENT_BUILD.stat().st_size, "filename": CLIENT_BUILD.name}
    return {"available": False}


@api_router.get("/client-build/download")
def client_build_download():
    if not CLIENT_BUILD.exists():
        raise HTTPException(404, "Client build not available")
    return FileResponse(str(CLIENT_BUILD), media_type="application/zip", filename=CLIENT_BUILD.name)


@api_router.get("/admin-build/info")
def admin_build_info():
    if ADMIN_BUILD.exists():
        return {"available": True, "size": ADMIN_BUILD.stat().st_size, "filename": ADMIN_BUILD.name}
    return {"available": False}


@api_router.get("/admin-build/download")
def admin_build_download():
    if not ADMIN_BUILD.exists():
        raise HTTPException(404, "Admin build not available")
    return FileResponse(str(ADMIN_BUILD), media_type="application/zip", filename=ADMIN_BUILD.name)


# ============ SEED ============
SEED = [
    {"app_id": "223308", "title": "Resident Evil 2 Remake", "category": "Horror / Action",
     "is_public": True, "in_store": False, "price": 0,
     "cover_url": "https://images.unsplash.com/photo-1582339980338-c4adc193bd12?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwyfHx2aWRlbyUyMGdhbWUlMjBwb3N0ZXIlMjBjb3ZlciUyMGN5YmVycHVuayUyMGZhbnRhc3klMjBnYW1pbmclMjBhcnR3b3JrfGVufDB8fHx8MTc4ODI5MDA5NHww&ixlib=rb-4.1.0&q=85"},
    {"app_id": "1091500", "title": "Cyberpunk 2077", "category": "Sci-Fi RPG",
     "is_public": False, "in_store": True, "price": 15,
     "cover_url": "https://images.unsplash.com/photo-1661715328971-83cd2179df82?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHw0fHx2aWRlbyUyMGdhbWUlMjBwb3N0ZXIlMjBjb3ZlciUyMGN5YmVycHVuayUyMGZhbnRhc3klMjBnYW1pbmclMjBhcnR3b3JrfGVufDB8fHx8MTc4ODI5MDA5NHww&ixlib=rb-4.1.0&q=85"},
    {"app_id": "844910", "title": "Neon Syndicate", "category": "Action / Cyberpunk",
     "is_public": False, "in_store": True, "price": 10,
     "cover_url": "https://images.unsplash.com/photo-1705510144116-cc4d88838b14?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMGdhbWUlMjBwb3N0ZXIlMjBjb3ZlciUyMGN5YmVycHVuayUyMGZhbnRhc3klMjBnYW1pbmclMjBhcnR3b3JrfGVufDB8fHx8MTc4ODI5MDA5NHww&ixlib=rb-4.1.0&q=85"},
]


def seed():
    try:
        existing = rows(supa.t("games").select("id").limit(1).execute())
        if existing:
            return
        logger.info("Seeding sample games...")
        for s in SEED:
            gid = str(uuid.uuid4())
            lua_content = f"-- {s['title']}\naddappid({s['app_id']})\n".encode()
            fid = str(uuid.uuid4())
            path = f"lua/{gid}/{fid}.lua"
            supa.upload(path, lua_content, "text/plain")
            row = {"id": gid, **s, "description": "", "is_deleted": False,
                   "lua_files": [{"id": fid, "filename": f"{s['app_id']}.lua", "path": path, "size": len(lua_content)}],
                   "created_at": now_iso(), "updated_at": now_iso()}
            supa.t("games").insert(row).execute()
        logger.info("Seeding complete.")
    except Exception as e:
        logger.error(f"Seed skipped: {e}")


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("startup")
def startup():
    supa.ensure_bucket()
    if supa.schema_ready():
        logger.info("Supabase schema ready.")
        seed()
    else:
        logger.warning("Supabase tables not found — run backend/supabase_schema.sql in the Supabase SQL Editor.")
