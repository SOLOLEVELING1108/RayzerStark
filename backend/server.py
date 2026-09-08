from fastapi import FastAPI, APIRouter, UploadFile, File, Form, Query, HTTPException, Depends, Request
from fastapi.responses import Response, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import uuid
import logging
import re
import time
from pathlib import Path
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import supa
import auth
import secrets
import string

app = FastAPI(title="Game Config Patcher API")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

MIME = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
    "webp": "image/webp", "dll": "application/octet-stream", "lua": "text/plain",
    "txt": "text/plain", "pdf": "application/pdf",
    "zip": "application/zip", "rar": "application/vnd.rar", "7z": "application/x-7z-compressed",
}

# --- CACHE DO GITHUB PRA EVITAR BLOQUEIO DE SPAM NO ENVIO EM MASSA ---
GITHUB_CACHE = []
GITHUB_CACHE_TIME = 0


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def ext_of(name, default="bin"):
    return (name.rsplit(".", 1)[-1] if "." in name else default).lower()


def normalize_file_url(url: str):
    u = (url or "").strip()
    if not u:
        return u, "bypass.zip"
    m = re.search(r"drive\.google\.com/file/d/([\w-]+)", u) \
        or re.search(r"drive\.google\.com/open\?id=([\w-]+)", u) \
        or re.search(r"[?&]id=([\w-]+)", u) if "drive.google" in u or "usercontent.google" in u else None
    if m:
        fid = m.group(1)
        return (f"https://drive.google.com/uc?export=download&id={fid}", "bypass.zip")
    if "dropbox.com" in u:
        u = u.replace("?dl=0", "?dl=1").replace("&dl=0", "&dl=1")
        if "dl=1" not in u:
            u = u + ("&dl=1" if "?" in u else "?dl=1")
        name = u.split("?")[0].rstrip("/").split("/")[-1] or "bypass.zip"
        return u, name
    name = u.split("?")[0].rstrip("/").split("/")[-1] or "bypass.zip"
    if "." not in name:
        name = "bypass.zip"
    try:
        from urllib.parse import unquote
        name = unquote(name)
    except Exception:
        pass
    return u, name


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
def current_principal(request: Request):
    p = auth.decode_token(request)
    role = p.get("role")
    if role == "admin":
        return {"role": "admin", "affiliate_id": None, "email": p.get("sub"), "name": "Admin"}
    if role == "affiliate" and p.get("affiliate_id"):
        aff = one(supa.t("affiliates").select("*").eq("id", p["affiliate_id"]).eq("active", True).execute())
        if not aff:
            raise HTTPException(401, "Afiliado inválido ou desativado")
        return {"role": "affiliate", "affiliate_id": aff["id"], "name": aff.get("name")}
    raise HTTPException(401, "Token inválido")


def _gen_aff_key():
    alpha = string.ascii_uppercase + string.digits
    grp = lambda: "".join(secrets.choice(alpha) for _ in range(4))
    return f"AFF-{grp()}-{grp()}-{grp()}"


@api_router.get("/affiliates")
def list_affiliates(admin: dict = Depends(auth.require_admin)):
    return rows(supa.t("affiliates").select("*").order("created_at", desc=True).execute())


@api_router.post("/affiliates")
def create_affiliate(payload: dict = None, admin: dict = Depends(auth.require_admin)):
    name = ((payload or {}).get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Informe o nome do afiliado.")
    for _ in range(5):
        key = _gen_aff_key()
        if not rows(supa.t("affiliates").select("id").eq("key", key).execute()):
            break
    row = {"id": str(uuid.uuid4()), "name": name, "key": key, "active": True, "created_at": now_iso()}
    supa.t("affiliates").insert(row).execute()
    return row


@api_router.delete("/affiliates/{aid}")
def delete_affiliate(aid: str, admin: dict = Depends(auth.require_admin)):
    supa.t("affiliates").delete().eq("id", aid).execute()
    return {"ok": True}


@api_router.post("/auth/login")
def login(payload: dict):
    p = payload or {}
    key = (p.get("affiliate_key") or "").strip().upper()
    if not key and not p.get("password") and (p.get("email") or "").strip().upper().startswith("AFF-"):
        key = (p.get("email") or "").strip().upper()
    if key:
        aff = one(supa.t("affiliates").select("*").eq("key", key).eq("active", True).execute())
        if not aff:
            raise HTTPException(401, "Key de afiliado inválida")
        return {"token": auth.create_affiliate_token(aff["id"], aff["name"]), "role": "affiliate", "name": aff["name"], "affiliate_id": aff["id"]}
    email = p.get("email", "")
    password = p.get("password", "")
    if not auth.verify_credentials(email, password):
        raise HTTPException(401, "E-mail ou senha inválidos")
    return {"token": auth.create_token(auth.ADMIN_EMAIL), "email": auth.ADMIN_EMAIL, "role": "admin"}


@api_router.get("/auth/me")
def me(principal=Depends(current_principal)):
    return principal


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


def get_steam_cover(app_id: str):
    app_id_clean = str(app_id).strip()
    url = f"https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id_clean}/header.jpg"
    try:
        import urllib.request
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=3) as r:
            if r.status == 200:
                return url
    except Exception:
        pass
    return "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop"


def normalize_str(text):
    if not text: return ""
    return re.sub(r'[^a-z0-9]', '', str(text).lower())


def fetch_github_bypass_url(app_id: str):
    """
    Busca o ZIP no GitHub. Usa um cache de 5 minutos pra aguentar o Envio em Massa!
    """
    global GITHUB_CACHE, GITHUB_CACHE_TIME
    GITHUB_OWNER = "SOLOLEVELING1108"
    GITHUB_REPO = "RayzerStark"
    
    try:
        # Só bate no GitHub de novo se passaram 5 minutos (300 segundos). Isso salva a gente do Anti-Spam!
        if not GITHUB_CACHE or (time.time() - GITHUB_CACHE_TIME > 300):
            import urllib.request
            import json as _json
            url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as r:
                GITHUB_CACHE = _json.loads(r.read().decode("utf-8"))
                GITHUB_CACHE_TIME = time.time()
                
        target_filename = f"{str(app_id).strip()}.zip"
        
        for rel in GITHUB_CACHE:
            for asset in rel.get("assets", []):
                if asset.get("name") == target_filename:
                    return asset.get("browser_download_url")
    except Exception as e:
        logger.error(f"Erro ao buscar no GitHub: {e}")
    return None


def ensure_bypass_exists(app_id: str, game_title: str):
    """
    Verifica se o Bypass existe. Força a verificação do Código do Jogo (app_id).
    """
    try:
        id_clean = str(app_id).strip()
        title_clean = normalize_str(game_title)
        if not id_clean: return None

        all_bypasses = rows(supa.t("bypasses").select("id, app_id, title, cover_url, category, file").eq("is_deleted", False).execute())

        for b in all_bypasses:
            b_app_id = str(b.get("app_id") or "").strip()
            b_title_clean = normalize_str(b.get("title") or "")

            is_match = False
            # PRIORIDADE MÁXIMA: Bater pelo número (ID do jogo)
            if b_app_id == id_clean:
                is_match = True
            elif title_clean and b_title_clean and len(title_clean) > 3:
                if title_clean in b_title_clean or b_title_clean in title_clean:
                    is_match = True

            if is_match:
                updates = {}
                if b_app_id != id_clean:
                    updates["app_id"] = id_clean
                
                current_cover = str(b.get("cover_url") or "")
                if not current_cover or current_cover == "EMPTY" or "http" not in current_cover:
                    updates["cover_url"] = get_steam_cover(id_clean)
                    b["cover_url"] = updates["cover_url"]
                    
                current_file = b.get("file") or {}
                if not current_file.get("url") and not current_file.get("path"):
                    gh_url = fetch_github_bypass_url(id_clean)
                    if gh_url:
                        direct, name = normalize_file_url(gh_url)
                        updates["file"] = {"filename": name, "url": direct, "size": 0}

                if updates:
                    updates["updated_at"] = now_iso()
                    supa.t("bypasses").update(updates).eq("id", b["id"]).execute()
                    
                return b 
                
        # Se não achou, cria um novo
        bid = str(uuid.uuid4())
        steam_cover = get_steam_cover(id_clean)
        
        github_url = fetch_github_bypass_url(id_clean)
        file_meta = {}
        if github_url:
            direct, name = normalize_file_url(github_url)
            file_meta = {"filename": name, "url": direct, "size": 0}
        
        new_bypass = {
            "id": bid,
            "app_id": id_clean,
            "title": game_title,
            "category": "Uncategorized",
            "description": "Bypass importado automaticamente do GitHub.",
            "cover_url": steam_cover,
            "file": file_meta,
            "is_deleted": False,
            "created_at": now_iso(),
            "updated_at": now_iso()
        }
        
        supa.t("bypasses").insert(new_bypass).execute()
        return new_bypass

    except Exception as e:
        logger.error(f"Erro na criação automática do Bypass: {e}")
    return None


# ============ ROTA DE REATUALIZAÇÃO DE EMERGÊNCIA (SYNC) ============
@api_router.get("/system/force-sync")
def force_sync_bypasses():
    """
    Varrer todos os jogos do banco e re-checar no GitHub se existe Bypass.
    Dá pra acessar direto colando a URL no navegador!
    """
    all_games = rows(supa.t("games").select("app_id, title").eq("is_deleted", False).execute())
    count = 0
    for g in all_games:
        ensure_bypass_exists(g["app_id"], g["title"])
        count += 1
    return {
        "status": "SUCESSO",
        "message": f"Sincronização forçada rodou perfeitamente! {count} jogos foram verificados e reatualizados com o GitHub."
    }


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
    matched_bypass = ensure_bypass_exists(app_id, title)
    final_cover = cover_url if cover_url else get_steam_cover(app_id)
    if cover is not None:
        ext = ext_of(cover.filename, "png")
        path = f"covers/{gid}.{ext}"
        supa.upload(path, await cover.read(), MIME.get(ext, "image/png"))
        final_cover = f"/api/files/download?path={path}"
        
    if matched_bypass:
        title = matched_bypass.get("title") or title
        category = matched_bypass.get("category") or category
        if matched_bypass.get("cover_url") and matched_bypass.get("cover_url") != "EMPTY" and cover is None:
            final_cover = matched_bypass.get("cover_url")
    
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


def resolve_steam_title(app_id: str):
    try:
        import urllib.request
        import json as _json
        url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&filters=basic&l=english"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as r:
            data = _json.loads(r.read().decode("utf-8"))
        node = data.get(str(app_id)) or {}
        if node.get("success") and node.get("data", {}).get("name"):
            return node["data"]["name"]
    except Exception:
        pass
    return None


@api_router.post("/games/bulk-lua")
async def bulk_lua(files: list[UploadFile] = File(...), admin: dict = Depends(auth.require_admin)):
    created = []
    for f in files:
        stem = (f.filename or "").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        app_id = stem[:-4] if stem.lower().endswith(".lua") else (stem.rsplit(".", 1)[0] if "." in stem else stem)
        app_id = app_id.strip()
        if not app_id:
            continue
            
        title = resolve_steam_title(app_id) or app_id
        final_category = "Uncategorized"
        final_cover = get_steam_cover(app_id)
        
        matched_bypass = ensure_bypass_exists(app_id, title)
        
        if matched_bypass:
            title = matched_bypass.get("title") or title
            final_category = matched_bypass.get("category") or final_category
            if matched_bypass.get("cover_url") and matched_bypass.get("cover_url") != "EMPTY":
                final_cover = matched_bypass.get("cover_url")

        gid = str(uuid.uuid4())
        content = await f.read()
        fid = str(uuid.uuid4())
        lpath = f"lua/{gid}/{fid}.lua"
        supa.upload(lpath, content, "text/plain")
        lua_entry = {"id": fid, "filename": f.filename, "path": lpath, "size": len(content)}
        
        row = {
            "id": gid, "app_id": app_id, "title": title, "category": final_category,
            "description": "", "cover_url": final_cover, "lua_files": [lua_entry],
            "in_store": False, "price": 0, "is_public": False,
            "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso(),
        }
        supa.t("games").insert(row).execute()
        created.append({"id": gid, "app_id": app_id, "title": title, "resolved": bool(title != app_id)})
    return {"created": created, "count": len(created)}


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


# ============ FILES (CORS BLINDADO) ============
@api_router.get("/files/download")
def download_file(path: str = Query(...)):
    if not path or ".." in path:
        raise HTTPException(400, "Invalid path")
    try:
        data = supa.download(path)
    except Exception as e:
        raise HTTPException(404, f"File not found: {e}")
    ext = ext_of(path, "bin")
    return Response(
        content=data, 
        media_type=MIME.get(ext, "application/octet-stream"),
        headers={"Access-Control-Allow-Origin": "*"}
    )


# ============ ACCESS KEYS ============
def _gen_key():
    alpha = string.ascii_uppercase + string.digits
    grp = lambda: "".join(secrets.choice(alpha) for _ in range(4))
    return f"RZR-{grp()}-{grp()}-{grp()}"


@api_router.post("/keys")
def create_key(payload: dict = None, principal: dict = Depends(current_principal)):
    p = payload or {}
    full_name = (p.get("full_name") or "").strip()
    email = (p.get("email") or "").strip()
    phone = (p.get("phone") or "").strip()
    if not full_name or not email or not phone:
        raise HTTPException(400, "Preencha nome completo, e-mail e telefone do cliente.")
    for _ in range(5):
        key = _gen_key()
        if not rows(supa.t("access_keys").select("id").eq("key", key).execute()):
            break
    if principal["role"] == "affiliate":
        aff_id, aff_name = principal["affiliate_id"], principal.get("name") or ""
    else:
        aff_id = p.get("affiliate_id") or None
        aff_name = ""
        if aff_id:
            a = one(supa.t("affiliates").select("name").eq("id", aff_id).execute())
            aff_name = a["name"] if a else ""
    row = {"id": str(uuid.uuid4()), "key": key, "hwid": None,
           "full_name": full_name, "email": email, "phone": phone, "label": p.get("label", ""),
           "affiliate_id": aff_id, "affiliate_name": aff_name,
           "status": "active", "created_at": now_iso(), "activated_at": None}
    supa.t("access_keys").insert(row).execute()
    return row


@api_router.get("/keys")
def list_keys(affiliate_id: str | None = None, principal: dict = Depends(current_principal)):
    q = supa.t("access_keys").select("*").order("created_at", desc=True)
    if principal["role"] == "affiliate":
        q = q.eq("affiliate_id", principal["affiliate_id"])
    elif affiliate_id:
        q = q.eq("affiliate_id", affiliate_id)
    return rows(q.execute())


def _owns_key(principal, kid):
    if principal["role"] == "admin":
        return True
    k = one(supa.t("access_keys").select("id,affiliate_id").eq("id", kid).execute())
    return bool(k and k.get("affiliate_id") == principal["affiliate_id"])


@api_router.delete("/keys/{kid}")
def delete_key(kid: str, principal: dict = Depends(current_principal)):
    if not _owns_key(principal, kid):
        raise HTTPException(404, "Key não encontrada")
    supa.t("access_keys").delete().eq("id", kid).execute()
    return {"ok": True}


@api_router.post("/keys/{kid}/reset")
def reset_key(kid: str, principal: dict = Depends(current_principal)):
    if not _owns_key(principal, kid):
        raise HTTPException(404, "Key não encontrada")
    supa.t("access_keys").update({"hwid": None, "activated_at": None, "status": "active"}).eq("id", kid).execute()
    return {"ok": True}


@api_router.post("/keys/validate")
def validate_key(payload: dict):
    key = (payload.get("key") or "").strip().upper()
    hwid = (payload.get("hwid") or "").strip()
    if not key or not hwid:
        return {"valid": False, "reason": "missing"}
    k = one(supa.t("access_keys").select("*").eq("key", key).execute())
    if not k:
        return {"valid": False, "reason": "not_found"}
    if k.get("status") != "active":
        return {"valid": False, "reason": "revoked"}
    if not k.get("hwid"):
        supa.t("access_keys").update({"hwid": hwid, "activated_at": now_iso()}).eq("id", k["id"]).execute()
        return {"valid": True, "reason": "activated"}
    if k["hwid"] == hwid:
        return {"valid": True, "reason": "ok"}
    return {"valid": False, "reason": "other_device"}


# ============ BYPASSES ============
@api_router.get("/bypasses")
def list_bypasses(search: str | None = None):
    data = rows(supa.t("bypasses").select("*").eq("is_deleted", False).order("created_at", desc=True).execute())
    if search:
        s = search.lower()
        data = [b for b in data if s in b["title"].lower() or s in str(b["app_id"]).lower()]
    return data


@api_router.get("/bypasses/{bid}")
def get_bypass(bid: str):
    b = one(supa.t("bypasses").select("*").eq("id", bid).eq("is_deleted", False).execute())
    if not b:
        raise HTTPException(404, "Bypass not found")
    return b


@api_router.post("/bypasses")
async def create_bypass(
    title: str = Form(...),
    app_id: str = Form(...),
    category: str = Form("Uncategorized"),
    description: str = Form(""),
    cover_url: str = Form(""),
    cover: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    file_url: str = Form(""),
    admin: dict = Depends(auth.require_admin),
):
    bid = str(uuid.uuid4())
    final_cover = cover_url
    if cover is not None:
        ext = ext_of(cover.filename, "png")
        path = f"bypass-covers/{bid}.{ext}"
        supa.upload(path, await cover.read(), MIME.get(ext, "image/png"))
        final_cover = f"/api/files/download?path={path}"
    file_meta = {}
    if file is not None:
        data = await file.read()
        ext = ext_of(file.filename, "zip")
        path = f"bypass/{bid}/{file.filename}"
        try:
            supa.upload(path, data, MIME.get(ext, "application/octet-stream"))
        except Exception:
            raise HTTPException(400, "Falha ao enviar o arquivo (talvez maior que o limite de ~50MB do Storage). Use um link externo (URL).")
        file_meta = {"filename": file.filename, "path": path, "size": len(data)}
    elif file_url:
        direct, name = normalize_file_url(file_url)
        file_meta = {"filename": name, "url": direct, "size": 0}
    row = {"id": bid, "app_id": app_id, "title": title, "category": category, "description": description,
           "cover_url": final_cover, "file": file_meta, "is_deleted": False,
           "created_at": now_iso(), "updated_at": now_iso()}
    supa.t("bypasses").insert(row).execute()
    return row


@api_router.put("/bypasses/{bid}")
def update_bypass(bid: str, payload: dict, admin: dict = Depends(auth.require_admin)):
    allowed = {"app_id", "title", "category", "description", "cover_url"}
    updates = {k: v for k, v in payload.items() if k in allowed and v is not None}
    if updates.get("cover_url", None) == "":
        updates.pop("cover_url")
    if payload.get("file_url"):
        direct, name = normalize_file_url(payload["file_url"])
        updates["file"] = {"filename": name, "url": direct, "size": 0}
    updates["updated_at"] = now_iso()
    supa.t("bypasses").update(updates).eq("id", bid).execute()
    return get_bypass(bid)


@api_router.post("/bypasses/{bid}/file")
async def set_bypass_file(bid: str, file: UploadFile = File(...), admin: dict = Depends(auth.require_admin)):
    b = get_bypass(bid)
    old = b.get("file") or {}
    if old.get("path"):
        supa.remove(old["path"])
    data = await file.read()
    ext = ext_of(file.filename, "zip")
    path = f"bypass/{bid}/{file.filename}"
    try:
        supa.upload(path, data, MIME.get(ext, "application/octet-stream"))
    except Exception:
        raise HTTPException(400, "Falha ao enviar o arquivo. Use um link externo (URL).")
    file_meta = {"filename": file.filename, "path": path, "size": len(data)}
    supa.t("bypasses").update({"file": file_meta, "updated_at": now_iso()}).eq("id", bid).execute()
    return get_bypass(bid)


@api_router.post("/bypasses/{bid}/cover")
async def set_bypass_cover(bid: str, cover: UploadFile = File(...), admin: dict = Depends(auth.require_admin)):
    get_bypass(bid)
    ext = ext_of(cover.filename, "png")
    path = f"bypass-covers/{bid}.{ext}"
    supa.upload(path, await cover.read(), MIME.get(ext, "image/png"))
    url = f"/api/files/download?path={path}"
    supa.t("bypasses").update({"cover_url": url, "updated_at": now_iso()}).eq("id", bid).execute()
    return get_bypass(bid)


@api_router.delete("/bypasses/{bid}")
def delete_bypass(bid: str, admin: dict = Depends(auth.require_admin)):
    b = one(supa.t("bypasses").select("*").eq("id", bid).execute())
    if b and (b.get("file") or {}).get("path"):
        supa.remove(b["file"]["path"])
    supa.t("bypasses").update({"is_deleted": True}).eq("id", bid).execute()
    return {"ok": True}


# ============ CLIENT BUILD (Windows portable zip) ============
CLIENT_BUILD = Path("/app/desktop/dist/RayzerStarkGame-Client-win-x64.zip")
ADMIN_BUILD = Path("/app/admin-desktop/dist/RayzerStarkGame-Admin-win-x64.zip")
CLIENT_APP_DIR = ROOT_DIR / "app" / "renderer"
NATIVE_APP_DIR = ROOT_DIR / "app"


@api_router.get("/client-native/bundle.json")
def client_native_bundle():
    import base64
    version = "1.0.0"
    try:
        import json as _json
        version = _json.loads((NATIVE_APP_DIR / "version.json").read_text()).get("version", "1.0.0")
    except Exception:
        pass
    files = {}
    if NATIVE_APP_DIR.exists():
        for p in NATIVE_APP_DIR.rglob("*"):
            if p.is_file() and p.name != "version.json":
                rel = p.relative_to(NATIVE_APP_DIR).as_posix()
                files[rel] = base64.b64encode(p.read_bytes()).decode("ascii")
    return {"version": version, "files": files}


@api_router.get("/client-version")
def client_version():
    try:
        import json as _json
        # Caminho inteligente: procura o package.json não importa onde o server.py esteja
        caminho_1 = ROOT_DIR / "desktop" / "package.json"
        caminho_2 = ROOT_DIR.parent / "desktop" / "package.json"
        
        if caminho_1.exists():
            v = _json.loads(caminho_1.read_text()).get("version", "1.0.5")
        elif caminho_2.exists():
            v = _json.loads(caminho_2.read_text()).get("version", "1.0.5")
        else:
            v = "1.0.5" # Se ele não achar o arquivo, força a leitura da versão 1.0.5
    except Exception:
        v = "1.0.5"
        
    return {"version": v}


@api_router.get("/client-build/info")
def client_build_info():
    return {"available": True, "size": 102000000, "filename": "RayzerStarkGame-Client-Update.zip"}


@api_router.get("/client-build/download")
def client_build_download():
    from fastapi.responses import StreamingResponse
    import urllib.request
    
    # ATENÇÃO: Confirme se esse link termina com ".zip" (Link direto do arquivo)
    github_link = "https://github.com/SOLOLEVELING1108/RayzerStark/releases/download/v1.0.5/Rayzer.Stark.Game-1.0.5-win.zip"
    
    def baixar_e_repassar():
        # O Render vai até o GitHub, baixa o arquivo em pedaços e entrega pro app
        req = urllib.request.Request(github_link, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            while chunk := response.read(8192 * 4):
                yield chunk
                
    return StreamingResponse(baixar_e_repassar(), media_type="application/zip", headers={
        "Content-Disposition": 'attachment; filename="update.zip"'
    })


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
def seed():
    pass


app.include_router(api_router)
app.mount("/api/client-app", StaticFiles(directory=str(CLIENT_APP_DIR), html=True), name="client-app")
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