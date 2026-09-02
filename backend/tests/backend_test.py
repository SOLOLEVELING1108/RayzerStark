"""Backend API tests for Game Config Patcher (Supabase edition).

Covers: games CRUD, categories, search/filter, lua upload/delete, dependencies,
settings/pix, store, purchase flow (create -> list -> count -> approve/reject),
library, package entitlement, file download.
"""
import io
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


ADMIN_EMAIL = "pf149429@gmail.com"
ADMIN_PASSWORD = "Wdsoneluiza123@@@@"


@pytest.fixture(scope="session")
def client():
    """Admin-authenticated session (admin routes need Bearer token)."""
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("token")
    if not token:
        pytest.fail("Login response has no token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def created_game_ids():
    return []


@pytest.fixture(scope="session", autouse=True)
def cleanup(client, created_game_ids):
    yield
    for gid in created_game_ids:
        try:
            client.delete(f"{API}/games/{gid}", timeout=30)
        except Exception:
            pass


def new_game(client, created_game_ids, **over):
    payload = {
        "title": over.get("title", f"TEST_Game_{uuid.uuid4().hex[:6]}"),
        "app_id": over.get("app_id", str(uuid.uuid4().int)[:6]),
        "category": over.get("category", "TEST_Category"),
        "description": over.get("description", "test desc"),
        "cover_url": over.get("cover_url", "https://example.com/c.png"),
        "is_public": str(over.get("is_public", False)).lower(),
        "in_store": str(over.get("in_store", False)).lower(),
        "price": str(over.get("price", 0)),
    }
    r = client.post(f"{API}/games", data=payload, timeout=60)
    assert r.status_code == 200, r.text
    g = r.json()
    created_game_ids.append(g["id"])
    return g


# ---------------- health / root ----------------
class TestHealth:
    def test_root(self, client):
        r = client.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get("schema_ready") is True


# ---------------- games ----------------
class TestGames:
    def test_list_games(self, client):
        r = client.get(f"{API}/games", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 3
        for g in data:
            assert "_id" not in g
            assert g["is_deleted"] is False
            for k in ("id", "app_id", "title", "category", "in_store", "price", "is_public", "lua_files"):
                assert k in g
        titles = {g["title"] for g in data}
        assert "Resident Evil 2 Remake" in titles
        assert "Cyberpunk 2077" in titles
        assert "Neon Syndicate" in titles

    def test_seed_flags(self, client):
        data = client.get(f"{API}/games", timeout=30).json()
        byt = {g["title"]: g for g in data}
        assert byt["Resident Evil 2 Remake"]["is_public"] is True
        assert byt["Cyberpunk 2077"]["in_store"] is True
        assert float(byt["Cyberpunk 2077"]["price"]) == 15
        assert float(byt["Neon Syndicate"]["price"]) == 10

    def test_categories(self, client):
        r = client.get(f"{API}/categories", timeout=30)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert "Sci-Fi RPG" in cats
        assert cats == sorted(cats)

    def test_search_by_title_and_appid(self, client):
        r = client.get(f"{API}/games", params={"search": "cyberpunk"}, timeout=30)
        assert r.status_code == 200
        assert all("cyberpunk" in g["title"].lower() or "cyberpunk" in g["app_id"] for g in r.json())
        r2 = client.get(f"{API}/games", params={"search": "844910"}, timeout=30)
        assert r2.status_code == 200
        assert [g["app_id"] for g in r2.json()] == ["844910"]

    def test_category_filter(self, client):
        r = client.get(f"{API}/games", params={"category": "Sci-Fi RPG"}, timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 1
        assert all(g["category"] == "Sci-Fi RPG" for g in r.json())
        rall = client.get(f"{API}/games", params={"category": "All"}, timeout=30)
        assert len(rall.json()) >= len(r.json())

    def test_create_game_and_persist(self, client, created_game_ids):
        g = new_game(client, created_game_ids, in_store=True, price=25.5, is_public=True)
        assert g["in_store"] is True
        assert float(g["price"]) == 25.5
        assert g["is_public"] is True
        got = client.get(f"{API}/games/{g['id']}", timeout=30)
        assert got.status_code == 200
        fetched = got.json()
        assert fetched["title"] == g["title"]
        assert fetched["app_id"] == g["app_id"]
        assert float(fetched["price"]) == 25.5
        assert fetched["is_public"] is True
        assert fetched["lua_files"] == []

    def test_create_game_with_cover_file(self, client, created_game_ids):
        r = client.post(
            f"{API}/games",
            data={"title": "TEST_CoverGame", "app_id": "999111", "category": "TEST_Category"},
            files={"cover": ("c.png", io.BytesIO(PNG), "image/png")},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        g = r.json()
        created_game_ids.append(g["id"])
        assert g["cover_url"].startswith("/api/files/download?path=covers/")
        dl = client.get(f"{BASE_URL}{g['cover_url']}", timeout=60)
        assert dl.status_code == 200
        assert dl.content == PNG

    def test_get_game_404(self, client):
        r = client.get(f"{API}/games/{uuid.uuid4()}", timeout=30)
        assert r.status_code == 404

    def test_update_game_metadata(self, client, created_game_ids):
        g = new_game(client, created_game_ids)
        r = client.put(
            f"{API}/games/{g['id']}",
            json={"title": "TEST_Updated", "in_store": True, "price": 7.5, "is_public": True, "category": "TEST_Cat2"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["title"] == "TEST_Updated"
        assert u["in_store"] is True
        assert float(u["price"]) == 7.5
        assert u["is_public"] is True
        f = client.get(f"{API}/games/{g['id']}", timeout=30).json()
        assert f["title"] == "TEST_Updated"
        assert f["category"] == "TEST_Cat2"
        assert float(f["price"]) == 7.5

    def test_update_empty_cover_url_does_not_wipe(self, client, created_game_ids):
        g = new_game(client, created_game_ids, cover_url="https://example.com/keep.png")
        r = client.put(f"{API}/games/{g['id']}", json={"title": "TEST_KeepCover", "cover_url": ""}, timeout=30)
        assert r.status_code == 200
        assert r.json()["cover_url"] == "https://example.com/keep.png"

    def test_update_toggle_off_flags(self, client, created_game_ids):
        g = new_game(client, created_game_ids, in_store=True, is_public=True, price=10)
        r = client.put(f"{API}/games/{g['id']}", json={"in_store": False, "is_public": False}, timeout=30)
        assert r.status_code == 200
        assert r.json()["in_store"] is False
        assert r.json()["is_public"] is False

    def test_delete_game_soft_delete(self, client, created_game_ids):
        g = new_game(client, created_game_ids)
        r = client.delete(f"{API}/games/{g['id']}", timeout=30)
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        assert client.get(f"{API}/games/{g['id']}", timeout=30).status_code == 404
        ids = [x["id"] for x in client.get(f"{API}/games", timeout=30).json()]
        assert g["id"] not in ids


# ---------------- lua files ----------------
class TestLua:
    def test_upload_and_remove_lua(self, client, created_game_ids):
        g = new_game(client, created_game_ids)
        content = b"-- test\naddappid(123456)\n"
        r = client.post(
            f"{API}/games/{g['id']}/lua",
            files={"file": ("test.lua", io.BytesIO(content), "text/plain")},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        lua = r.json()["lua_files"]
        assert len(lua) == 1
        entry = lua[0]
        assert entry["filename"] == "test.lua"
        assert entry["size"] == len(content)
        assert entry["path"].startswith(f"lua/{g['id']}/")

        dl = client.get(f"{API}/files/download", params={"path": entry["path"]}, timeout=60)
        assert dl.status_code == 200
        assert dl.content == content

        # persisted
        assert len(client.get(f"{API}/games/{g['id']}", timeout=30).json()["lua_files"]) == 1

        rm = client.delete(f"{API}/games/{g['id']}/lua/{entry['id']}", timeout=60)
        assert rm.status_code == 200
        assert rm.json()["lua_files"] == []
        assert client.get(f"{API}/games/{g['id']}", timeout=30).json()["lua_files"] == []

    def test_upload_lua_unknown_game_404(self, client):
        r = client.post(
            f"{API}/games/{uuid.uuid4()}/lua",
            files={"file": ("a.lua", io.BytesIO(b"x"), "text/plain")},
            timeout=60,
        )
        assert r.status_code == 404


# ---------------- dependencies ----------------
class TestDependencies:
    def test_dependency_crud(self, client):
        data = b"MZ_TEST_DLL_BYTES"
        r = client.post(
            f"{API}/dependencies",
            files={"file": ("TEST_dep.dll", io.BytesIO(data), "application/octet-stream")},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        dep = r.json()
        assert dep["filename"] == "TEST_dep.dll"
        assert dep["size"] == len(data)
        assert dep["path"].startswith("deps/")

        listed = client.get(f"{API}/dependencies", timeout=30)
        assert listed.status_code == 200
        assert dep["id"] in [d["id"] for d in listed.json()]

        dl = client.get(f"{API}/files/download", params={"path": dep["path"]}, timeout=60)
        assert dl.status_code == 200 and dl.content == data

        rm = client.delete(f"{API}/dependencies/{dep['id']}", timeout=60)
        assert rm.status_code == 200
        assert dep["id"] not in [d["id"] for d in client.get(f"{API}/dependencies", timeout=30).json()]


# ---------------- settings / pix ----------------
class TestSettings:
    def test_get_and_update_settings(self, client):
        orig = client.get(f"{API}/settings", timeout=30)
        assert orig.status_code == 200
        before = orig.json()
        for k in ("pix_key", "pix_type", "pix_holder"):
            assert k in before

        payload = {"pix_type": "email", "pix_key": "test_pix@example.com", "pix_holder": "TEST Holder"}
        r = client.put(f"{API}/settings", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["pix_type"] == "email"
        assert u["pix_key"] == "test_pix@example.com"
        assert u["pix_holder"] == "TEST Holder"

        again = client.get(f"{API}/settings", timeout=30).json()
        assert again["pix_key"] == "test_pix@example.com"

        # restore
        client.put(
            f"{API}/settings",
            json={
                "pix_type": before.get("pix_type") or "",
                "pix_key": before.get("pix_key") or "",
                "pix_holder": before.get("pix_holder") or "",
            },
            timeout=30,
        )


# ---------------- store / purchases / library / package ----------------
class TestPurchaseFlow:
    def test_store_listing_flags(self, client, created_game_ids):
        g = new_game(client, created_game_ids, in_store=True, price=12)
        device = f"TEST-DEV-{uuid.uuid4().hex[:6]}"
        r = client.get(f"{API}/store", params={"device_code": device}, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert all(i["in_store"] is True for i in items)
        mine = [i for i in items if i["id"] == g["id"]]
        assert len(mine) == 1
        assert mine[0]["owned"] is False and mine[0]["pending"] is False

    def test_full_purchase_approve_flow(self, client, created_game_ids):
        g = new_game(client, created_game_ids, in_store=True, price=20)
        device = f"TEST-DEV-{uuid.uuid4().hex[:6]}"

        # create purchase
        r = client.post(
            f"{API}/purchases",
            data={"device_code": device, "device_name": "TEST PC", "game_id": g["id"]},
            files={"receipt": ("receipt.png", io.BytesIO(PNG), "image/png")},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        pur = r.json()
        assert pur["status"] == "pending"
        assert pur["device_code"] == device
        assert pur["receipt_path"].startswith(f"receipts/{device}/")

        # pending list contains it with enriched fields
        pend = client.get(f"{API}/purchases", params={"status": "pending"}, timeout=30)
        assert pend.status_code == 200
        row = next((p for p in pend.json() if p["id"] == pur["id"]), None)
        assert row is not None
        assert row["game_title"] == g["title"]
        assert row["game_app_id"] == g["app_id"]
        assert float(row["game_price"]) == 20
        assert row["receipt_url"] == f"/api/files/download?path={pur['receipt_path']}"

        # receipt downloadable
        assert client.get(f"{BASE_URL}{row['receipt_url']}", timeout=60).content == PNG

        # count
        cnt = client.get(f"{API}/purchases/count", timeout=30)
        assert cnt.status_code == 200
        assert cnt.json()["pending"] >= 1

        # store shows pending
        st = client.get(f"{API}/store", params={"device_code": device}, timeout=30).json()
        assert next(i for i in st if i["id"] == g["id"])["pending"] is True

        # no entitlement -> package 403
        assert client.get(f"{API}/games/{g['id']}/package", params={"device_code": device}, timeout=30).status_code == 403
        assert client.get(f"{API}/games/{g['id']}/package", timeout=30).status_code == 403

        # approve
        ap = client.post(f"{API}/purchases/{pur['id']}/approve", timeout=30)
        assert ap.status_code == 200, ap.text
        assert ap.json() == {"ok": True}

        approved = client.get(f"{API}/purchases", params={"status": "approved"}, timeout=30).json()
        arow = next((p for p in approved if p["id"] == pur["id"]), None)
        assert arow is not None and arow["status"] == "approved"
        assert arow.get("resolved_at")

        # library shows owned
        lib = client.get(f"{API}/library", params={"device_code": device}, timeout=30)
        assert lib.status_code == 200
        libitem = next((x for x in lib.json() if x["id"] == g["id"]), None)
        assert libitem is not None and libitem["source"] == "owned"
        # public seed game also present
        assert any(x["source"] == "public" for x in lib.json())

        # store now owned
        st2 = client.get(f"{API}/store", params={"device_code": device}, timeout=30).json()
        assert next(i for i in st2 if i["id"] == g["id"])["owned"] is True

        # package now 200
        pk = client.get(f"{API}/games/{g['id']}/package", params={"device_code": device}, timeout=30)
        assert pk.status_code == 200, pk.text
        body = pk.json()
        assert body["game_id"] == g["id"] and body["app_id"] == g["app_id"]
        assert isinstance(body["files"], list)

        # idempotent approve
        assert client.post(f"{API}/purchases/{pur['id']}/approve", timeout=30).status_code == 200

    def test_reject_flow(self, client, created_game_ids):
        g = new_game(client, created_game_ids, in_store=True, price=5)
        device = f"TEST-DEV-{uuid.uuid4().hex[:6]}"
        r = client.post(
            f"{API}/purchases",
            data={"device_code": device, "device_name": "TEST PC2", "game_id": g["id"]},
            files={"receipt": ("r.png", io.BytesIO(PNG), "image/png")},
            timeout=60,
        )
        pid = r.json()["id"]
        rj = client.post(f"{API}/purchases/{pid}/reject", timeout=30)
        assert rj.status_code == 200
        rejected = client.get(f"{API}/purchases", params={"status": "rejected"}, timeout=30).json()
        assert next(p for p in rejected if p["id"] == pid)["status"] == "rejected"
        # no entitlement granted
        lib = client.get(f"{API}/library", params={"device_code": device}, timeout=30).json()
        assert all(x["id"] != g["id"] for x in lib)

    def test_approve_unknown_purchase_404(self, client):
        r = client.post(f"{API}/purchases/{uuid.uuid4()}/approve", timeout=30)
        assert r.status_code == 404

    def test_public_game_package_without_device(self, client, created_game_ids):
        g = new_game(client, created_game_ids, is_public=True)
        r = client.get(f"{API}/games/{g['id']}/package", timeout=30)
        assert r.status_code == 200
        assert r.json()["title"] == g["title"]

    def test_library_requires_device_code(self, client):
        r = client.get(f"{API}/library", timeout=30)
        assert r.status_code == 422


# ---------------- files ----------------
class TestFiles:
    def test_download_missing_file_404(self, client):
        r = client.get(f"{API}/files/download", params={"path": "lua/nope/nope.lua"}, timeout=60)
        assert r.status_code == 404

    def test_download_path_traversal_blocked(self, client):
        r = client.get(f"{API}/files/download", params={"path": "../secret.txt"}, timeout=30)
        assert r.status_code == 400

    def test_download_requires_path(self, client):
        r = client.get(f"{API}/files/download", timeout=30)
        assert r.status_code == 422
