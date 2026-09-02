"""Auth (single-admin JWT) + admin/public endpoint boundary tests."""
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
def anon():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(anon):
    r = anon.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    t = r.json().get("token")
    assert isinstance(t, str) and len(t) > 20
    return t


@pytest.fixture(scope="module")
def admin(token):
    s = requests.Session()
    s.headers.update({"Accept": "application/json", "Authorization": f"Bearer {token}"})
    return s


# ---------------- login / me ----------------
class TestLogin:
    def test_login_success(self, anon):
        r = anon.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["role"] == "admin"
        assert isinstance(d["token"], str) and len(d["token"]) > 20

    def test_login_case_insensitive_email(self, anon):
        r = anon.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL.upper(), "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text

    def test_login_wrong_password(self, anon):
        r = anon.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "nope"}, timeout=30)
        assert r.status_code == 401

    def test_login_wrong_email(self, anon):
        r = anon.post(f"{API}/auth/login", json={"email": "hacker@x.com", "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 401

    def test_login_missing_fields(self, anon):
        r = anon.post(f"{API}/auth/login", json={}, timeout=30)
        assert r.status_code == 401

    def test_me_with_token(self, admin):
        r = admin.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d == {"email": ADMIN_EMAIL, "role": "admin"}

    def test_me_without_token(self, anon):
        assert anon.get(f"{API}/auth/me", timeout=30).status_code == 401

    def test_me_with_garbage_token(self, anon):
        r = anon.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.jwt"}, timeout=30)
        assert r.status_code == 401

    def test_me_with_wrong_scheme(self, anon):
        r = anon.get(f"{API}/auth/me", headers={"Authorization": f"Token abc"}, timeout=30)
        assert r.status_code == 401


# ---------------- admin-only boundary: 401 without token ----------------
ADMIN_ROUTES = [
    ("POST", "/games", {"data": {"title": "X", "app_id": "1"}}),
    ("PUT", "/games/some-id", {"json": {"title": "X"}}),
    ("DELETE", "/games/some-id", {}),
    ("POST", "/games/some-id/lua", {"files": {"file": ("a.lua", b"x", "text/plain")}}),
    ("DELETE", "/games/some-id/lua/f1", {}),
    ("POST", "/games/some-id/cover", {"files": {"cover": ("a.png", PNG, "image/png")}}),
    ("POST", "/dependencies", {"files": {"file": ("a.dll", b"x", "application/octet-stream")}}),
    ("DELETE", "/dependencies/some-id", {}),
    ("PUT", "/settings", {"json": {"pix_key": "x"}}),
    ("GET", "/purchases", {}),
    ("GET", "/purchases/count", {}),
    ("POST", "/purchases/some-id/approve", {}),
    ("POST", "/purchases/some-id/reject", {}),
    ("POST", "/bypasses", {"data": {"title": "X", "app_id": "1"}}),
    ("PUT", "/bypasses/some-id", {"json": {"title": "X"}}),
    ("DELETE", "/bypasses/some-id", {}),
    ("POST", "/bypasses/some-id/file", {"files": {"file": ("a.zip", b"x", "application/zip")}}),
    ("POST", "/bypasses/some-id/cover", {"files": {"cover": ("a.png", PNG, "image/png")}}),
]

PUBLIC_ROUTES = [
    "/games",
    "/categories",
    "/store",
    "/dependencies",
    "/settings",
    "/bypasses",
    "/client-build/info",
    "/admin-build/info",
    "/",
]


class TestBoundaries:
    @pytest.mark.parametrize("method,path,kw", ADMIN_ROUTES, ids=[f"{m}{p}" for m, p, _ in ADMIN_ROUTES])
    def test_admin_route_requires_token(self, anon, method, path, kw):
        r = anon.request(method, f"{API}{path}", timeout=45, **kw)
        assert r.status_code == 401, f"{method} {path} -> {r.status_code} {r.text[:200]}"

    @pytest.mark.parametrize("path", PUBLIC_ROUTES)
    def test_public_routes_open(self, anon, path):
        r = anon.get(f"{API}{path}", timeout=30)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_public_library_and_download_and_purchase_create(self, anon, admin):
        dev = f"TEST-DEV-{uuid.uuid4().hex[:6]}"
        assert anon.get(f"{API}/library", params={"device_code": dev}, timeout=30).status_code == 200
        games = anon.get(f"{API}/games", timeout=30).json()
        assert games
        gid = games[0]["id"]
        assert anon.get(f"{API}/games/{gid}", timeout=30).status_code == 200
        # public purchase creation (no token)
        r = anon.post(
            f"{API}/purchases",
            data={"device_code": dev, "device_name": "TEST PC", "game_id": gid},
            files={"receipt": ("r.png", io.BytesIO(PNG), "image/png")},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        # cleanup: reject the purchase with admin
        admin.post(f"{API}/purchases/{pid}/reject", timeout=30)

    def test_admin_routes_succeed_with_token(self, admin):
        assert admin.get(f"{API}/purchases", timeout=30).status_code == 200
        c = admin.get(f"{API}/purchases/count", timeout=30)
        assert c.status_code == 200 and isinstance(c.json()["pending"], int)
