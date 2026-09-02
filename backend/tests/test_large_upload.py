"""Large bypass file upload: must return a clear 400 (not 500) when over the Supabase ~50MB cap."""
import io
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

base = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
API = base.rstrip("/") + "/api"
ADMIN = {"email": "pf149429@gmail.com", "password": "Wdsoneluiza123@@@@"}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


def test_over_limit_upload_returns_400_not_500(admin):
    size = 55 * 1024 * 1024
    content = b"0" * size
    form = {"title": f"TEST_Large_{uuid.uuid4().hex[:6]}", "app_id": "424242", "category": "TEST_Category"}
    r = admin.post(
        f"{API}/bypasses",
        data=form,
        files={"file": ("TEST_large.zip", io.BytesIO(content), "application/x-zip-compressed")},
        timeout=600,
    )
    print("status", r.status_code, r.text[:300])
    if r.status_code == 200:
        # unexpectedly succeeded -> clean up
        admin.delete(f"{API}/bypasses/{r.json()['id']}", timeout=60)
        pytest.skip("Storage accepted a 55MB file; limit not hit in this environment")
    assert r.status_code != 500, f"expected clear 4xx, got 500: {r.text[:300]}"
    assert r.status_code in (400, 413), r.status_code
    if r.status_code == 400:
        assert "50MB" in r.text or "URL" in r.text
