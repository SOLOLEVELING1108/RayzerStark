"""Supabase client + storage/table helpers.

Endpoints run in Starlette's threadpool (plain `def` routes), so we keep ONE
Supabase client PER THREAD (thread-local). Sharing a single sync client across
threads corrupts its httpx keep-alive connections and causes intermittent 500s.
"""
import os
import threading
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from supabase import create_client, Client

URL = os.environ["SUPABASE_URL"]
KEY = os.environ["SUPABASE_KEY"]
BUCKET = os.environ.get("SUPABASE_BUCKET", "game-files")

_local = threading.local()


def client() -> Client:
    c = getattr(_local, "client", None)
    if c is None:
        c = create_client(URL, KEY)
        _local.client = c
    return c


def ensure_bucket():
    try:
        names = [b.name for b in client().storage.list_buckets()]
        if BUCKET not in names:
            client().storage.create_bucket(BUCKET, options={"public": False})
    except Exception as e:
        print("ensure_bucket:", e)


def schema_ready() -> bool:
    try:
        client().table("games").select("id").limit(1).execute()
        return True
    except Exception:
        return False


def upload(path: str, data: bytes, content_type: str) -> str:
    client().storage.from_(BUCKET).upload(path, data, {"content-type": content_type, "upsert": "true"})
    return path


def download(path: str) -> bytes:
    return client().storage.from_(BUCKET).download(path)


def remove(path: str):
    try:
        client().storage.from_(BUCKET).remove([path])
    except Exception:
        pass


def t(name: str):
    return client().table(name)
