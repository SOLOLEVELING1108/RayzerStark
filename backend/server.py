from fastapi import FastAPI, APIRouter, UploadFile, File, Form, Query, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from storage import put_object, get_object, init_storage, APP_NAME

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Game Config Patcher API")
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)

# Injection target tokens resolved by the desktop client.
TARGET_BY_TYPE = {
    "dll": "steam_root",           # C:\Program Files (x86)\Steam
    "lua": "steam_config_lua",     # C:\Program Files (x86)\Steam\config\lua
}
MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
    "webp": "image/webp", "dll": "application/octet-stream", "lua": "text/plain",
}


# ---------- Models ----------
class GameFile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str                 # "dll" | "lua"
    original_filename: str
    storage_path: str
    size: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Game(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    app_id: str
    title: str
    category: str = "Uncategorized"
    description: str = ""
    cover_url: str = ""
    files: List[GameFile] = Field(default_factory=list)
    is_deleted: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GameUpdate(BaseModel):
    app_id: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ---------- Games CRUD ----------
@api_router.get("/")
async def root():
    return {"message": "Game Config Patcher API", "app": APP_NAME}


@api_router.get("/games", response_model=List[Game])
async def list_games(search: Optional[str] = None, category: Optional[str] = None):
    query = {"is_deleted": False}
    if category and category != "All":
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"app_id": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.games.find(query).sort("created_at", -1).to_list(1000)
    return [Game(**clean(d)) for d in docs]


@api_router.get("/categories")
async def list_categories():
    cats = await db.games.distinct("category", {"is_deleted": False})
    return sorted([c for c in cats if c])


@api_router.get("/games/{game_id}", response_model=Game)
async def get_game(game_id: str):
    doc = await db.games.find_one({"id": game_id, "is_deleted": False})
    if not doc:
        raise HTTPException(404, "Game not found")
    return Game(**clean(doc))


@api_router.post("/games", response_model=Game)
async def create_game(
    title: str = Form(...),
    app_id: str = Form(...),
    category: str = Form("Uncategorized"),
    description: str = Form(""),
    cover_url: str = Form(""),
    cover: Optional[UploadFile] = File(None),
):
    game = Game(title=title, app_id=app_id, category=category, description=description, cover_url=cover_url)
    if cover is not None:
        ext = (cover.filename.rsplit(".", 1)[-1] if "." in cover.filename else "png").lower()
        path = f"{APP_NAME}/covers/{game.id}.{ext}"
        data = await cover.read()
        result = put_object(path, data, MIME_TYPES.get(ext, cover.content_type or "image/png"))
        game.cover_url = f"/api/files/download?path={result['path']}"
    await db.games.insert_one(game.model_dump())
    return game


@api_router.put("/games/{game_id}", response_model=Game)
async def update_game(game_id: str, payload: GameUpdate):
    doc = await db.games.find_one({"id": game_id, "is_deleted": False})
    if not doc:
        raise HTTPException(404, "Game not found")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    # Never overwrite an existing cover with an empty string
    if updates.get("cover_url", None) == "":
        updates.pop("cover_url")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.games.update_one({"id": game_id}, {"$set": updates})
    doc = await db.games.find_one({"id": game_id})
    return Game(**clean(doc))


@api_router.delete("/games/{game_id}")
async def delete_game(game_id: str):
    res = await db.games.update_one({"id": game_id}, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Game not found")
    return {"ok": True}


# ---------- File management ----------
@api_router.post("/games/{game_id}/files", response_model=Game)
async def add_file(game_id: str, file_type: str = Form(...), file: UploadFile = File(...)):
    if file_type not in TARGET_BY_TYPE:
        raise HTTPException(400, "file_type must be 'dll' or 'lua'")
    doc = await db.games.find_one({"id": game_id, "is_deleted": False})
    if not doc:
        raise HTTPException(404, "Game not found")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else file_type).lower()
    fid = str(uuid.uuid4())
    path = f"{APP_NAME}/games/{game_id}/{fid}.{ext}"
    data = await file.read()
    result = put_object(path, data, MIME_TYPES.get(ext, "application/octet-stream"))
    gf = GameFile(id=fid, type=file_type, original_filename=file.filename,
                  storage_path=result["path"], size=result.get("size", len(data)))
    await db.games.update_one(
        {"id": game_id},
        {"$push": {"files": gf.model_dump()},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    doc = await db.games.find_one({"id": game_id})
    return Game(**clean(doc))


@api_router.delete("/games/{game_id}/files/{file_id}", response_model=Game)
async def remove_file(game_id: str, file_id: str):
    doc = await db.games.find_one({"id": game_id, "is_deleted": False})
    if not doc:
        raise HTTPException(404, "Game not found")
    await db.games.update_one({"id": game_id}, {"$pull": {"files": {"id": file_id}}})
    doc = await db.games.find_one({"id": game_id})
    return Game(**clean(doc))


# ---------- Injection package (used by desktop client) ----------
@api_router.get("/games/{game_id}/package")
async def get_package(game_id: str):
    doc = await db.games.find_one({"id": game_id, "is_deleted": False})
    if not doc:
        raise HTTPException(404, "Game not found")
    game = Game(**clean(doc))
    items = []
    for f in game.files:
        items.append({
            "id": f.id,
            "type": f.type,
            "filename": f.original_filename,
            "target": TARGET_BY_TYPE[f.type],
            "download_path": f.storage_path,
            "size": f.size,
        })
    return {
        "game_id": game.id,
        "app_id": game.app_id,
        "title": game.title,
        "targets": {
            "steam_root": "Steam",
            "steam_config_lua": "Steam\\config\\lua",
        },
        "files": items,
    }


@api_router.get("/files/download")
async def download_file(path: str = Query(...)):
    if not path.startswith(f"{APP_NAME}/"):
        raise HTTPException(400, "Invalid path")
    try:
        data, content_type = get_object(path)
    except Exception as e:
        raise HTTPException(404, f"File not found: {e}")
    return Response(content=data, media_type=content_type)


# ---------- Seed ----------
SEED_GAMES = [
    {"app_id": "223308", "title": "Resident Evil 2 Remake", "category": "Horror / Action",
     "description": "Survival horror classic. Injects RE Engine dependencies and the config script.",
     "cover_url": "https://images.unsplash.com/photo-1582339980338-c4adc193bd12?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwyfHx2aWRlbyUyMGdhbWUlMjBwb3N0ZXIlMjBjb3ZlciUyMGN5YmVycHVuayUyMGZhbnRhc3klMjBnYW1pbmclMjBhcnR3b3JrfGVufDB8fHx8MTc4ODI5MDA5NHww&ixlib=rb-4.1.0&q=85"},
    {"app_id": "1091500", "title": "Cyberpunk 2077", "category": "Sci-Fi RPG",
     "description": "Open-world RPG in Night City. Loads engine tweaks and unlock script.",
     "cover_url": "https://images.unsplash.com/photo-1661715328971-83cd2179df82?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHw0fHx2aWRlbyUyMGdhbWUlMjBwb3N0ZXIlMjBjb3ZlciUyMGN5YmVycHVuayUyMGZhbnRhc3klMjBnYW1pbmclMjBhcnR3b3JrfGVufDB8fHx8MTc4ODI5MDA5NHww&ixlib=rb-4.1.0&q=85"},
    {"app_id": "844910", "title": "Neon Syndicate", "category": "Action / Cyberpunk",
     "description": "Fast-paced cyberpunk shooter with online dependencies.",
     "cover_url": "https://images.unsplash.com/photo-1705510144116-cc4d88838b14?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMGdhbWUlMjBwb3N0ZXIlMjBjb3ZlciUyMGN5YmVycHVuayUyMGZhbnRhc3klMjBnYW1pbmclMjBhcnR3b3JrfGVufDB8fHx8MTc4ODI5MDA5NHww&ixlib=rb-4.1.0&q=85"},
    {"app_id": "509300", "title": "Armored Mecha V", "category": "Simulation / Mecha",
     "description": "Mecha combat sim. Physics hook + mod scripts.",
     "cover_url": "https://images.unsplash.com/photo-1613014510867-a47a0e5bf564?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwzfHx2aWRlbyUyMGdhbWUlMjBwb3N0ZXIlMjBjb3ZlciUyMGN5YmVycHVuayUyMGZhbnRhc3klMjBnYW1pbmclMjBhcnR3b3JrfGVufDB8fHx8MTc4ODI5MDA5NHww&ixlib=rb-4.1.0&q=85"},
]


async def seed():
    count = await db.games.count_documents({})
    if count > 0:
        return
    logger.info("Seeding sample games...")
    for s in SEED_GAMES:
        game = Game(**s)
        # generate a real .lua file so the injection flow works end-to-end
        lua_content = f"-- {game.title}\naddappid({game.app_id})\n".encode()
        fid = str(uuid.uuid4())
        path = f"{APP_NAME}/games/{game.id}/{fid}.lua"
        try:
            result = put_object(path, lua_content, "text/plain")
            game.files.append(GameFile(id=fid, type="lua", original_filename=f"{game.app_id}.lua",
                                       storage_path=result["path"], size=result.get("size", len(lua_content))))
        except Exception as e:
            logger.error(f"seed lua upload failed: {e}")
        await db.games.insert_one(game.model_dump())
    logger.info("Seeding complete.")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await db.games.create_index("id")
    await seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
