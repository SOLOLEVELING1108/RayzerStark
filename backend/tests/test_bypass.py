"""BYPASS CRUD tests (admin-protected create/update/delete, public read)."""
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

ADMIN_EMAIL = "pf149429@gmail.com"
ADMIN_PASSWORD = "Wdsoneluiza123@@@@"

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin, created_ids):
    yield
    for bid in created_ids:
        try:
            admin.delete(f"{API}/bypasses/{bid}", timeout=30)
        except Exception:
            pass


def make_bypass(admin, created_ids, with_file=True, with_cover=False):
    data = {
        "title": f"TEST_Bypass_{uuid.uuid4().hex[:6]}",
        "app_id": str(uuid.uuid4().int)[:6],
        "category": "TEST_Category",
        "description": "test bypass desc",
    }
    files = {}
    if with_file:
        files["file"] = ("bypass.zip", io.BytesIO(b"PK_TEST_BYPASS_PAYLOAD"), "application/zip")
    if with_cover:
        files["cover"] = ("c.png", io.BytesIO(PNG), "image/png")
    else:
        data["cover_url"] = "https://example.com/b.png"
    r = admin.post(f"{API}/bypasses", data=data, files=files or None, timeout=60)
    assert r.status_code == 200, r.text
    b = r.json()
    created_ids.append(b["id"])
    return data, b


class TestBypassCRUD:
    def test_create_with_file_and_download(self, admin, created_ids):
        payload, b = make_bypass(admin, created_ids)
        assert "_id" not in b
        assert b["title"] == payload["title"]
        assert b["app_id"] == payload["app_id"]
        assert b["category"] == "TEST_Category"
        assert b["description"] == "test bypass desc"
        assert b["cover_url"] == "https://example.com/b.png"
        assert b["is_deleted"] is False
        f = b["file"]
        assert f["filename"] == "bypass.zip"
        assert f["size"] == len(b"PK_TEST_BYPASS_PAYLOAD")
        assert f["path"] == f"bypass/{b['id']}/bypass.zip"

        # persisted via GET
        got = admin.get(f"{API}/bypasses/{b['id']}", timeout=30)
        assert got.status_code == 200
        assert got.json()["file"]["path"] == f["path"]

        # file downloadable publicly
        dl = requests.get(f"{API}/files/download", params={"path": f["path"]}, timeout=60)
        assert dl.status_code == 200
        assert dl.content == b"PK_TEST_BYPASS_PAYLOAD"

    def test_create_with_cover_file(self, admin, created_ids):
        _, b = make_bypass(admin, created_ids, with_cover=True)
        assert b["cover_url"].startswith("/api/files/download?path=bypass-covers/")
        dl = requests.get(f"{BASE_URL}{b['cover_url']}", timeout=60)
        assert dl.status_code == 200 and dl.content == PNG

    def test_list_public_contains_created(self, admin, created_ids):
        _, b = make_bypass(admin, created_ids)
        r = requests.get(f"{API}/bypasses", timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        row = next((x for x in items if x["id"] == b["id"]), None)
        assert row is not None
        assert row["title"] == b["title"]
        assert all("_id" not in x for x in items)

    def test_search(self, admin, created_ids):
        _, b = make_bypass(admin, created_ids)
        r = requests.get(f"{API}/bypasses", params={"search": b["app_id"]}, timeout=30)
        assert r.status_code == 200
        assert [x["app_id"] for x in r.json()] == [b["app_id"]]
        r2 = requests.get(f"{API}/bypasses", params={"search": b["title"].lower()}, timeout=30)
        assert b["id"] in [x["id"] for x in r2.json()]

    def test_get_404(self, admin):
        assert admin.get(f"{API}/bypasses/{uuid.uuid4()}", timeout=30).status_code == 404

    def test_update(self, admin, created_ids):
        _, b = make_bypass(admin, created_ids, with_file=False)
        r = admin.put(f"{API}/bypasses/{b['id']}",
                      json={"title": "TEST_Bypass_Updated", "category": "TEST_Cat2", "description": "d2"}, timeout=30)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["title"] == "TEST_Bypass_Updated"
        assert u["category"] == "TEST_Cat2"
        assert u["description"] == "d2"
        fetched = admin.get(f"{API}/bypasses/{b['id']}", timeout=30).json()
        assert fetched["title"] == "TEST_Bypass_Updated"
        assert fetched["updated_at"] != b["updated_at"]

    def test_update_empty_cover_url_kept(self, admin, created_ids):
        _, b = make_bypass(admin, created_ids, with_file=False)
        r = admin.put(f"{API}/bypasses/{b['id']}", json={"cover_url": ""}, timeout=30)
        assert r.status_code == 200
        assert r.json()["cover_url"] == "https://example.com/b.png"

    def test_replace_file(self, admin, created_ids):
        _, b = make_bypass(admin, created_ids)
        new = b"NEW_BYPASS_BYTES_LONGER"
        r = admin.post(f"{API}/bypasses/{b['id']}/file",
                       files={"file": ("newfile.rar", io.BytesIO(new), "application/vnd.rar")}, timeout=60)
        assert r.status_code == 200, r.text
        f = r.json()["file"]
        assert f["filename"] == "newfile.rar"
        assert f["size"] == len(new)
        dl = requests.get(f"{API}/files/download", params={"path": f["path"]}, timeout=60)
        assert dl.status_code == 200 and dl.content == new
        # old file removed
        old = requests.get(f"{API}/files/download", params={"path": f"bypass/{b['id']}/bypass.zip"}, timeout=60)
        assert old.status_code == 404

    def test_set_cover(self, admin, created_ids):
        _, b = make_bypass(admin, created_ids, with_file=False)
        r = admin.post(f"{API}/bypasses/{b['id']}/cover",
                       files={"cover": ("c.png", io.BytesIO(PNG), "image/png")}, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json()["cover_url"] == f"/api/files/download?path=bypass-covers/{b['id']}.png"

    def test_file_upload_unknown_bypass_404(self, admin):
        r = admin.post(f"{API}/bypasses/{uuid.uuid4()}/file",
                       files={"file": ("a.zip", io.BytesIO(b"x"), "application/zip")}, timeout=60)
        assert r.status_code == 404

    def test_soft_delete(self, admin, created_ids):
        _, b = make_bypass(admin, created_ids)
        r = admin.delete(f"{API}/bypasses/{b['id']}", timeout=60)
        assert r.status_code == 200 and r.json() == {"ok": True}
        assert admin.get(f"{API}/bypasses/{b['id']}", timeout=30).status_code == 404
        assert b["id"] not in [x["id"] for x in requests.get(f"{API}/bypasses", timeout=30).json()]

    def test_create_missing_required_422(self, admin):
        r = admin.post(f"{API}/bypasses", data={"title": "only title"}, timeout=30)
        assert r.status_code == 422

    def test_create_without_file_allowed(self, admin, created_ids):
        _, b = make_bypass(admin, created_ids, with_file=False)
        assert b["file"] in ({}, None)
