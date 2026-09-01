"""Backend API tests for Game Config Patcher (games CRUD, files, package, download)."""
import os
import io

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    return s


@pytest.fixture(scope="session")
def created_game_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup(api_client, created_game_ids):
    yield
    for gid in created_game_ids:
        api_client.delete(f"{API}/games/{gid}", timeout=30)


# ---------- Health / catalog ----------
class TestCatalog:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/", timeout=30)
        assert r.status_code == 200, r.text
        assert "app" in r.json()

    def test_list_games_seeded(self, api_client):
        r = api_client.get(f"{API}/games", timeout=30)
        assert r.status_code == 200, r.text
        games = r.json()
        assert isinstance(games, list)
        assert len(games) >= 4, f"expected >=4 seeded games, got {len(games)}"
        titles = [g["title"] for g in games]
        for t in ["Resident Evil 2 Remake", "Cyberpunk 2077", "Neon Syndicate", "Armored Mecha V"]:
            assert t in titles, f"missing seeded game {t}"
        g = next(x for x in games if x["title"] == "Cyberpunk 2077")
        for f in ["id", "app_id", "title", "category", "cover_url", "files"]:
            assert f in g
        assert g["app_id"] == "1091500"
        assert isinstance(g["files"], list) and len(g["files"]) >= 1
        lua = g["files"][0]
        assert lua["type"] == "lua"
        assert lua["original_filename"] == "1091500.lua"
        assert lua["size"] > 0
        assert "_id" not in g

    def test_categories(self, api_client):
        r = api_client.get(f"{API}/categories", timeout=30)
        assert r.status_code == 200, r.text
        cats = r.json()
        assert isinstance(cats, list)
        assert "Sci-Fi RPG" in cats
        assert cats == sorted(cats)

    def test_search_by_title(self, api_client):
        r = api_client.get(f"{API}/games", params={"search": "Cyberpunk"}, timeout=30)
        assert r.status_code == 200
        games = r.json()
        assert len(games) >= 1
        assert all("cyberpunk" in g["title"].lower() or "cyberpunk" in g["app_id"] for g in games)

    def test_search_by_app_id(self, api_client):
        r = api_client.get(f"{API}/games", params={"search": "1091500"}, timeout=30)
        assert r.status_code == 200
        games = r.json()
        assert len(games) == 1
        assert games[0]["app_id"] == "1091500"

    def test_search_no_match(self, api_client):
        r = api_client.get(f"{API}/games", params={"search": "ZZZ_NOPE_QQQ"}, timeout=30)
        assert r.status_code == 200
        assert r.json() == []

    def test_category_filter(self, api_client):
        r = api_client.get(f"{API}/games", params={"category": "Sci-Fi RPG"}, timeout=30)
        assert r.status_code == 200
        games = r.json()
        assert len(games) >= 1
        assert all(g["category"] == "Sci-Fi RPG" for g in games)

    def test_category_all(self, api_client):
        r = api_client.get(f"{API}/games", params={"category": "All"}, timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 4

    def test_get_game_404(self, api_client):
        r = api_client.get(f"{API}/games/does-not-exist", timeout=30)
        assert r.status_code == 404


# ---------- Download of seeded lua ----------
class TestDownload:
    def test_download_seeded_lua(self, api_client):
        games = api_client.get(f"{API}/games", params={"search": "1091500"}, timeout=30).json()
        path = games[0]["files"][0]["storage_path"]
        r = api_client.get(f"{API}/files/download", params={"path": path}, timeout=60)
        assert r.status_code == 200, r.text
        assert b"addappid(1091500)" in r.content

    def test_download_missing_path(self, api_client):
        r = api_client.get(f"{API}/files/download", params={"path": "nope/missing-file.lua"}, timeout=60)
        assert r.status_code == 404, f"expected 404, got {r.status_code}"

    def test_download_missing_param(self, api_client):
        r = api_client.get(f"{API}/files/download", timeout=30)
        assert r.status_code == 422


# ---------- Game CRUD + files ----------
class TestGameLifecycle:
    def test_create_update_files_package_delete(self, api_client, created_game_ids):
        # CREATE (no cover file)
        r = api_client.post(f"{API}/games", data={
            "title": "TEST_Game Alpha",
            "app_id": "999001",
            "category": "TEST_Category",
            "description": "TEST desc",
            "cover_url": "https://example.com/x.png",
        }, timeout=60)
        assert r.status_code == 200, r.text
        game = r.json()
        gid = game["id"]
        created_game_ids.append(gid)
        assert game["title"] == "TEST_Game Alpha"
        assert game["app_id"] == "999001"
        assert game["category"] == "TEST_Category"
        assert game["files"] == []
        assert game["is_deleted"] is False

        # GET verify persistence
        r = api_client.get(f"{API}/games/{gid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Game Alpha"

        # category appears in categories
        cats = api_client.get(f"{API}/categories", timeout=30).json()
        assert "TEST_Category" in cats

        # UPLOAD lua
        lua_bytes = b"addappid(999001)\n"
        r = api_client.post(f"{API}/games/{gid}/files",
                            data={"file_type": "lua"},
                            files={"file": ("999001.lua", io.BytesIO(lua_bytes), "text/plain")}, timeout=120)
        assert r.status_code == 200, r.text
        g = r.json()
        assert len(g["files"]) == 1
        lua = g["files"][0]
        assert lua["type"] == "lua"
        assert lua["original_filename"] == "999001.lua"
        assert lua["size"] == len(lua_bytes)

        # UPLOAD dll
        dll_bytes = b"MZ\x00fake-dll-bytes"
        r = api_client.post(f"{API}/games/{gid}/files",
                            data={"file_type": "dll"},
                            files={"file": ("hook.dll", io.BytesIO(dll_bytes), "application/octet-stream")}, timeout=120)
        assert r.status_code == 200, r.text
        g = r.json()
        assert len(g["files"]) == 2
        dll = [f for f in g["files"] if f["type"] == "dll"][0]

        # invalid file_type
        r = api_client.post(f"{API}/games/{gid}/files",
                            data={"file_type": "exe"},
                            files={"file": ("x.exe", io.BytesIO(b"x"), "application/octet-stream")}, timeout=60)
        assert r.status_code == 400, f"expected 400 got {r.status_code}"

        # upload to unknown game
        r = api_client.post(f"{API}/games/nope-id/files",
                            data={"file_type": "lua"},
                            files={"file": ("x.lua", io.BytesIO(b"x"), "text/plain")}, timeout=60)
        assert r.status_code == 404

        # download uploaded files
        r = api_client.get(f"{API}/files/download", params={"path": lua["storage_path"]}, timeout=60)
        assert r.status_code == 200
        assert r.content == lua_bytes
        r = api_client.get(f"{API}/files/download", params={"path": dll["storage_path"]}, timeout=60)
        assert r.status_code == 200
        assert r.content == dll_bytes

        # PACKAGE
        r = api_client.get(f"{API}/games/{gid}/package", timeout=30)
        assert r.status_code == 200, r.text
        pkg = r.json()
        assert pkg["app_id"] == "999001"
        assert pkg["targets"]["steam_root"] == "Steam"
        assert pkg["targets"]["steam_config_lua"] == "Steam\\config\\lua"
        assert len(pkg["files"]) == 2
        by_type = {f["type"]: f for f in pkg["files"]}
        assert by_type["lua"]["target"] == "steam_config_lua"
        assert by_type["dll"]["target"] == "steam_root"
        for f in pkg["files"]:
            assert f["download_path"] and f["filename"] and f["size"] > 0

        # UPDATE
        r = api_client.put(f"{API}/games/{gid}", json={"title": "TEST_Game Beta", "category": "TEST_Cat2"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["title"] == "TEST_Game Beta"
        got = api_client.get(f"{API}/games/{gid}", timeout=30).json()
        assert got["title"] == "TEST_Game Beta"
        assert got["category"] == "TEST_Cat2"
        assert got["app_id"] == "999001"
        assert len(got["files"]) == 2

        # UPDATE 404
        assert api_client.put(f"{API}/games/nope-id", json={"title": "x"}, timeout=30).status_code == 404

        # REMOVE file
        r = api_client.delete(f"{API}/games/{gid}/files/{lua['id']}", timeout=30)
        assert r.status_code == 200, r.text
        g = r.json()
        assert len(g["files"]) == 1
        assert all(f["id"] != lua["id"] for f in g["files"])
        got = api_client.get(f"{API}/games/{gid}", timeout=30).json()
        assert len(got["files"]) == 1

        # DELETE (soft)
        r = api_client.delete(f"{API}/games/{gid}", timeout=30)
        assert r.status_code == 200
        assert api_client.get(f"{API}/games/{gid}", timeout=30).status_code == 404
        all_games = api_client.get(f"{API}/games", timeout=30).json()
        assert gid not in [x["id"] for x in all_games]

        # DELETE 404
        assert api_client.delete(f"{API}/games/nope-id", timeout=30).status_code == 404

    def test_create_with_cover_upload(self, api_client, created_game_ids):
        png = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 32)
        r = api_client.post(f"{API}/games",
                            data={"title": "TEST_Cover Game", "app_id": "999002", "category": "TEST_Category"},
                            files={"cover": ("cover.png", io.BytesIO(png), "image/png")}, timeout=120)
        assert r.status_code == 200, r.text
        g = r.json()
        created_game_ids.append(g["id"])
        assert g["cover_url"].startswith("/api/files/download?path=")
        path = g["cover_url"].split("path=", 1)[1]
        r = api_client.get(f"{API}/files/download", params={"path": path}, timeout=60)
        assert r.status_code == 200
        assert r.content == png
        assert r.headers["content-type"].startswith("image/png")

    def test_create_missing_required_fields(self, api_client):
        r = api_client.post(f"{API}/games", data={"title": "TEST_NoAppId"}, timeout=30)
        assert r.status_code == 422

    def test_package_404(self, api_client):
        assert api_client.get(f"{API}/games/nope-id/package", timeout=30).status_code == 404
