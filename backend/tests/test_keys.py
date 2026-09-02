"""ACCESS KEYS tests: admin generate/list/delete/reset + public validate (HWID binding).
Also covers BYPASS external file_url (create + update) and small-file upload/download."""
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

KEY_RE = r"^RZR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def anon():
    return requests.Session()


@pytest.fixture(scope="module")
def created_keys():
    return []


@pytest.fixture(scope="module")
def created_bypasses():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin, created_keys, created_bypasses):
    yield
    for kid in created_keys:
        try:
            admin.delete(f"{API}/keys/{kid}", timeout=30)
        except Exception:
            pass
    for bid in created_bypasses:
        try:
            admin.delete(f"{API}/bypasses/{bid}", timeout=30)
        except Exception:
            pass


def new_key(admin, created_keys, label=None):
    label = label or f"TEST_{uuid.uuid4().hex[:6]}"
    r = admin.post(f"{API}/keys", json={"label": label}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    k = r.json()
    created_keys.append(k["id"])
    return k


# ---------- ACCESS KEYS: admin CRUD ----------
class TestKeysAdmin:
    def test_generate_key(self, admin, created_keys):
        import re
        label = f"TEST_gen_{uuid.uuid4().hex[:6]}"
        k = new_key(admin, created_keys, label)
        assert re.match(KEY_RE, k["key"]), f"bad key format {k['key']}"
        assert k["hwid"] is None
        assert k["status"] == "active"
        assert k["label"] == label
        assert isinstance(k["id"], str)
        assert "_id" not in k

        # verify persisted in list
        lst = admin.get(f"{API}/keys", timeout=30)
        assert lst.status_code == 200
        rows = lst.json()
        assert isinstance(rows, list)
        found = [x for x in rows if x["id"] == k["id"]]
        assert found, "generated key missing from GET /api/keys"
        assert found[0]["key"] == k["key"]
        assert found[0]["label"] == label

    def test_generate_key_without_label(self, admin, created_keys):
        r = admin.post(f"{API}/keys", json={}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        k = r.json()
        created_keys.append(k["id"])
        assert k["label"] == ""

    def test_keys_unique(self, admin, created_keys):
        keys = {new_key(admin, created_keys)["key"] for _ in range(3)}
        assert len(keys) == 3

    def test_delete_key(self, admin, created_keys):
        k = new_key(admin, created_keys)
        r = admin.delete(f"{API}/keys/{k['id']}", timeout=30)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        rows = admin.get(f"{API}/keys", timeout=30).json()
        assert not [x for x in rows if x["id"] == k["id"]], "deleted key still listed"

    def test_reset_key_clears_hwid(self, admin, anon, created_keys):
        k = new_key(admin, created_keys)
        v = anon.post(f"{API}/keys/validate", json={"key": k["key"], "hwid": "PC-RESET"}, timeout=30)
        assert v.json() == {"valid": True, "reason": "activated"}
        r = admin.post(f"{API}/keys/{k['id']}/reset", timeout=30)
        assert r.status_code == 200
        row = [x for x in admin.get(f"{API}/keys", timeout=30).json() if x["id"] == k["id"]][0]
        assert row["hwid"] is None
        assert row["activated_at"] is None
        assert row["status"] == "active"
        # after reset a different PC can bind
        v2 = anon.post(f"{API}/keys/validate", json={"key": k["key"], "hwid": "PC-OTHER"}, timeout=30)
        assert v2.json() == {"valid": True, "reason": "activated"}


# ---------- ACCESS KEYS: public validate / HWID binding ----------
class TestKeysValidate:
    def test_bind_then_same_pc_then_other_pc(self, admin, anon, created_keys):
        k = new_key(admin, created_keys)
        first = anon.post(f"{API}/keys/validate", json={"key": k["key"], "hwid": "PC-A"}, timeout=30)
        assert first.status_code == 200
        assert first.json() == {"valid": True, "reason": "activated"}

        again = anon.post(f"{API}/keys/validate", json={"key": k["key"], "hwid": "PC-A"}, timeout=30)
        assert again.json() == {"valid": True, "reason": "ok"}

        other = anon.post(f"{API}/keys/validate", json={"key": k["key"], "hwid": "PC-B"}, timeout=30)
        assert other.json() == {"valid": False, "reason": "other_device"}

        # binding persisted in admin listing
        row = [x for x in admin.get(f"{API}/keys", timeout=30).json() if x["id"] == k["id"]][0]
        assert row["hwid"] == "PC-A"
        assert row["activated_at"]

    def test_key_case_insensitive_and_trimmed(self, admin, anon, created_keys):
        k = new_key(admin, created_keys)
        r = anon.post(f"{API}/keys/validate", json={"key": f"  {k['key'].lower()} ", "hwid": "PC-CASE"}, timeout=30)
        assert r.json() == {"valid": True, "reason": "activated"}

    def test_unknown_key(self, anon):
        r = anon.post(f"{API}/keys/validate", json={"key": "RZR-ZZZZ-ZZZZ-ZZZZ", "hwid": "PC-A"}, timeout=30)
        assert r.status_code == 200
        assert r.json() == {"valid": False, "reason": "not_found"}

    def test_missing_fields(self, anon):
        assert anon.post(f"{API}/keys/validate", json={"key": "", "hwid": "PC-A"}, timeout=30).json()["reason"] == "missing"
        assert anon.post(f"{API}/keys/validate", json={"key": "RZR-AAAA-BBBB-CCCC"}, timeout=30).json()["reason"] == "missing"

    def test_deleted_key_not_valid(self, admin, anon, created_keys):
        k = new_key(admin, created_keys)
        anon.post(f"{API}/keys/validate", json={"key": k["key"], "hwid": "PC-DEL"}, timeout=30)
        admin.delete(f"{API}/keys/{k['id']}", timeout=30)
        r = anon.post(f"{API}/keys/validate", json={"key": k["key"], "hwid": "PC-DEL"}, timeout=30)
        assert r.json()["valid"] is False
        assert r.json()["reason"] == "not_found"


# ---------- AUTH boundary ----------
class TestKeysAuthBoundary:
    def test_admin_routes_require_token(self, anon, admin, created_keys):
        k = new_key(admin, created_keys)
        assert anon.get(f"{API}/keys", timeout=30).status_code == 401
        assert anon.post(f"{API}/keys", json={"label": "x"}, timeout=30).status_code == 401
        assert anon.delete(f"{API}/keys/{k['id']}", timeout=30).status_code == 401
        assert anon.post(f"{API}/keys/{k['id']}/reset", timeout=30).status_code == 401

    def test_validate_is_public(self, admin, anon, created_keys):
        k = new_key(admin, created_keys)
        r = anon.post(f"{API}/keys/validate", json={"key": k["key"], "hwid": "PC-PUB"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["valid"] is True

    def test_bad_token_rejected(self, created_keys):
        s = requests.Session()
        s.headers.update({"Authorization": "Bearer not-a-token"})
        assert s.get(f"{API}/keys", timeout=30).status_code == 401


# ---------- BYPASS file upload + external URL ----------
class TestBypassFile:
    def _form(self):
        return {
            "title": f"TEST_ByFile_{uuid.uuid4().hex[:6]}",
            "app_id": str(uuid.uuid4().int)[:6],
            "category": "TEST_Category",
            "description": "d",
        }

    def test_small_zip_upload_and_download(self, admin, created_bypasses):
        content = os.urandom(1024 * 512)  # 512KB
        fname = f"TEST_{uuid.uuid4().hex[:6]}.zip"
        r = admin.post(
            f"{API}/bypasses",
            data=self._form(),
            files={"file": (fname, io.BytesIO(content), "application/x-zip-compressed")},
            timeout=120,
        )
        assert r.status_code == 200, r.text[:500]
        b = r.json()
        created_bypasses.append(b["id"])
        f = b["file"]
        assert f["filename"] == fname
        assert f["size"] == len(content)
        assert f["path"].startswith(f"bypass/{b['id']}/")
        assert "url" not in f

        got = admin.get(f"{API}/bypasses/{b['id']}", timeout=30).json()
        assert got["file"]["path"] == f["path"]

        dl = requests.get(f"{API}/files/download", params={"path": f["path"]}, timeout=120)
        assert dl.status_code == 200, dl.text[:200]
        assert dl.content == content

    def test_create_with_external_url(self, admin, created_bypasses):
        form = self._form()
        form["file_url"] = "https://example.com/big-bypass.rar"
        r = admin.post(f"{API}/bypasses", data=form, timeout=60)
        assert r.status_code == 200, r.text[:500]
        b = r.json()
        created_bypasses.append(b["id"])
        assert b["file"] == {"filename": "big-bypass.rar", "url": "https://example.com/big-bypass.rar", "size": 0}
        got = admin.get(f"{API}/bypasses/{b['id']}", timeout=30).json()
        assert got["file"]["url"] == "https://example.com/big-bypass.rar"

    def test_update_file_url(self, admin, created_bypasses):
        r = admin.post(f"{API}/bypasses", data=self._form(), timeout=60)
        assert r.status_code == 200, r.text[:400]
        b = r.json()
        created_bypasses.append(b["id"])
        assert b["file"] in ({}, None)

        up = admin.put(
            f"{API}/bypasses/{b['id']}",
            json={"file_url": "https://cdn.example.com/files/patch.zip?token=abc"},
            timeout=60,
        )
        assert up.status_code == 200, up.text[:400]
        assert up.json()["file"] == {
            "filename": "patch.zip",
            "url": "https://cdn.example.com/files/patch.zip?token=abc",
            "size": 0,
        }
        got = admin.get(f"{API}/bypasses/{b['id']}", timeout=30).json()
        assert got["file"]["filename"] == "patch.zip"

    def test_create_bypass_requires_admin(self):
        s = requests.Session()
        form = {"title": "TEST_x", "app_id": "1", "file_url": "https://example.com/a.zip"}
        assert s.post(f"{API}/bypasses", data=form, timeout=30).status_code == 401
