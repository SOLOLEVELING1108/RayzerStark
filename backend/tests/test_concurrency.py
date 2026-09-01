"""Concurrency test: the module-level Supabase sync client is shared across
FastAPI threadpool threads (all endpoints are `def`, not `async def`).
Verifies concurrent requests do not produce 500s (httpx RemoteProtocolError).
"""
import os
from concurrent.futures import ThreadPoolExecutor

import requests
from dotenv import dotenv_values

base = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
API = base.rstrip("/") + "/api"


def hit(path):
    try:
        r = requests.get(f"{API}{path}", timeout=60)
        return r.status_code
    except Exception as e:
        return f"EXC {e}"


def test_concurrent_reads_no_500():
    paths = ["/games", "/categories", "/purchases/count", "/dependencies", "/settings"] * 6
    with ThreadPoolExecutor(max_workers=10) as ex:
        codes = list(ex.map(hit, paths))
    bad = [c for c in codes if c != 200]
    assert not bad, f"{len(bad)}/{len(codes)} concurrent requests failed: {bad[:10]}"
