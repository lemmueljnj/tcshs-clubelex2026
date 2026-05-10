"""Backend tests for branding/settings feature.

- GET /api/settings is public, returns name + logo_url (defaults to CampusVote/empty).
- PATCH /api/admin/settings updates name and/or logo_url (admin only).
- Validation: empty name -> 400, no fields -> 400.
- Auth: missing token -> 401, student token -> 403.
- Partial updates preserve untouched fields.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "ltungcs2009@gmail.com"
ADMIN_PASS = "Lemmuel26Tungcul_"

DEFAULT_NAME = "CampusVote"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def student_token(admin_h):
    """Create + approve a student to get a non-admin token."""
    email = f"brand.student+{uuid.uuid4().hex[:8]}@school.edu"
    # add to voter list so register auto-approves
    requests.post(f"{API}/admin/voter-list", headers=admin_h, json={"email": email, "name": "Brand S"})
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "Brand S"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module", autouse=True)
def reset_brand_after(admin_h):
    """Ensure branding is reset to defaults at end of module."""
    yield
    requests.patch(f"{API}/admin/settings", headers=admin_h, json={"name": DEFAULT_NAME, "logo_url": ""})


# ---------- Public GET ----------
def test_get_settings_public_no_auth():
    r = requests.get(f"{API}/settings")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "name" in data and "logo_url" in data
    assert isinstance(data["name"], str) and len(data["name"]) > 0
    assert isinstance(data["logo_url"], str)


# ---------- Auth checks for PATCH ----------
def test_patch_settings_requires_auth():
    r = requests.patch(f"{API}/admin/settings", json={"name": "X"})
    assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"


def test_patch_settings_forbidden_for_student(student_token):
    h = {"Authorization": f"Bearer {student_token}"}
    r = requests.patch(f"{API}/admin/settings", headers=h, json={"name": "X"})
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# ---------- Validation ----------
def test_patch_settings_empty_name_rejected(admin_h):
    r = requests.patch(f"{API}/admin/settings", headers=admin_h, json={"name": "   "})
    assert r.status_code == 400, r.text


def test_patch_settings_no_fields_rejected(admin_h):
    r = requests.patch(f"{API}/admin/settings", headers=admin_h, json={})
    assert r.status_code == 400, r.text


# ---------- Update flows ----------
def test_patch_settings_updates_both_fields_and_persists(admin_h):
    new_name = f"TEST Brand {uuid.uuid4().hex[:6]}"
    new_logo = "https://example.com/logo-test.png"
    r = requests.patch(f"{API}/admin/settings", headers=admin_h,
                       json={"name": new_name, "logo_url": new_logo})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == new_name
    assert data["logo_url"] == new_logo

    # Verify GET reflects the change (public)
    g = requests.get(f"{API}/settings")
    assert g.status_code == 200
    gd = g.json()
    assert gd["name"] == new_name
    assert gd["logo_url"] == new_logo


def test_patch_settings_only_name_preserves_logo(admin_h):
    # set baseline with a logo
    requests.patch(f"{API}/admin/settings", headers=admin_h,
                   json={"name": "BaselineName", "logo_url": "https://example.com/baseline.png"})
    new_name = f"OnlyName {uuid.uuid4().hex[:5]}"
    r = requests.patch(f"{API}/admin/settings", headers=admin_h, json={"name": new_name})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == new_name
    assert data["logo_url"] == "https://example.com/baseline.png", "logo_url should be preserved"

    g = requests.get(f"{API}/settings").json()
    assert g["name"] == new_name
    assert g["logo_url"] == "https://example.com/baseline.png"


def test_patch_settings_only_logo_preserves_name(admin_h):
    requests.patch(f"{API}/admin/settings", headers=admin_h,
                   json={"name": "PreservedName", "logo_url": "https://example.com/old.png"})
    new_logo = "https://example.com/new-logo.png"
    r = requests.patch(f"{API}/admin/settings", headers=admin_h, json={"logo_url": new_logo})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "PreservedName"
    assert data["logo_url"] == new_logo

    g = requests.get(f"{API}/settings").json()
    assert g["name"] == "PreservedName"
    assert g["logo_url"] == new_logo


def test_patch_settings_reset_to_defaults(admin_h):
    r = requests.patch(f"{API}/admin/settings", headers=admin_h,
                       json={"name": DEFAULT_NAME, "logo_url": ""})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == DEFAULT_NAME
    assert data["logo_url"] == ""

    g = requests.get(f"{API}/settings").json()
    assert g["name"] == DEFAULT_NAME
    assert g["logo_url"] == ""
