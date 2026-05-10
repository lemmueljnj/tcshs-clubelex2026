"""Tests for the new admin user management endpoints."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "ltungcs2009@gmail.com"
ADMIN_PASS = "Lemmuel26Tungcul_"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def seeded_admin_id(admin_h):
    r = requests.get(f"{API}/auth/me", headers=admin_h)
    assert r.status_code == 200
    return r.json()["id"]


# ---------- Auth/role guards ----------
def test_list_admins_anonymous_401():
    r = requests.get(f"{API}/admin/admins")
    assert r.status_code == 401


def test_list_admins_student_403():
    email = f"student.adminmgmt.{uuid.uuid4().hex[:8]}@school.edu"
    rr = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "S"})
    tok = rr.json()["token"]
    r = requests.get(f"{API}/admin/admins", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403


def test_list_admins_admin_ok(admin_h, seeded_admin_id):
    r = requests.get(f"{API}/admin/admins", headers=admin_h)
    assert r.status_code == 200
    admins = r.json()
    assert isinstance(admins, list)
    assert any(a["id"] == seeded_admin_id for a in admins)
    for a in admins:
        assert a["role"] == "admin"
        assert "password_hash" not in a
        assert "_id" not in a


# ---------- Create admin ----------
def test_create_admin_anonymous_401():
    r = requests.post(f"{API}/admin/admins", json={
        "email": f"a.{uuid.uuid4().hex[:6]}@school.edu", "name": "X", "password": "secret123"
    })
    assert r.status_code == 401


def test_create_admin_student_403():
    email = f"student2.{uuid.uuid4().hex[:8]}@school.edu"
    rr = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "S"})
    tok = rr.json()["token"]
    r = requests.post(f"{API}/admin/admins",
                     headers={"Authorization": f"Bearer {tok}"},
                     json={"email": f"x.{uuid.uuid4().hex[:6]}@school.edu", "name": "X", "password": "secret123"})
    assert r.status_code == 403


def test_create_admin_and_login(admin_h):
    email = f"newadmin.{uuid.uuid4().hex[:8]}@school.edu"
    pw = "AdminPass123!"
    r = requests.post(f"{API}/admin/admins", headers=admin_h,
                     json={"email": email, "name": "New Admin", "password": pw})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "admin"
    assert body["status"] == "approved"
    assert body["email"] == email
    assert "password_hash" not in body and "_id" not in body
    new_id = body["id"]

    # New admin can login
    r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r2.status_code == 200
    new_tok = r2.json()["token"]
    assert r2.json()["user"]["role"] == "admin"

    # New admin can access admin endpoints
    r3 = requests.get(f"{API}/admin/admins", headers={"Authorization": f"Bearer {new_tok}"})
    assert r3.status_code == 200
    assert any(a["id"] == new_id for a in r3.json())

    # New admin appears in list
    r4 = requests.get(f"{API}/admin/admins", headers=admin_h)
    assert any(a["id"] == new_id for a in r4.json())


def test_create_admin_duplicate_email(admin_h):
    r = requests.post(f"{API}/admin/admins", headers=admin_h,
                     json={"email": ADMIN_EMAIL, "name": "Dup", "password": "anything123"})
    assert r.status_code == 400
    assert "already" in r.json().get("detail", "").lower()


def test_create_admin_short_password_422(admin_h):
    r = requests.post(f"{API}/admin/admins", headers=admin_h,
                     json={"email": f"sp.{uuid.uuid4().hex[:6]}@school.edu", "name": "S", "password": "12"})
    assert r.status_code == 422


# ---------- Delete admin ----------
def test_delete_self_blocked(admin_h, seeded_admin_id):
    r = requests.delete(f"{API}/admin/admins/{seeded_admin_id}", headers=admin_h)
    assert r.status_code == 400
    assert "own" in r.json().get("detail", "").lower()


def test_delete_non_existent_404(admin_h):
    r = requests.delete(f"{API}/admin/admins/{uuid.uuid4()}", headers=admin_h)
    assert r.status_code == 404


def test_delete_non_admin_user_404(admin_h):
    # create a student
    email = f"stutarget.{uuid.uuid4().hex[:8]}@school.edu"
    rr = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "S"})
    student_id = rr.json()["user"]["id"]
    r = requests.delete(f"{API}/admin/admins/{student_id}", headers=admin_h)
    assert r.status_code == 404


def test_delete_admin_success_and_last_admin_guard(admin_h, seeded_admin_id):
    """
    Strategy (per other_misc_info):
    - Create 2 extra admins (A and B)
    - Delete A successfully
    - Verify B is in list
    - Try to delete the seeded admin (self) -> blocked by self-guard
    - Use B's token to try to delete the seeded admin -> succeeds in principle, but we
      DO NOT do that because we must keep the seeded admin alive.
    - Instead: delete B as the seeded admin (success, leaves only seeded admin)
    - Then attempt to delete the seeded admin via... we can't because of self-guard.
      So we exercise the last-admin guard by: creating one extra admin C, then having
      C delete the seeded admin? No, that would lock us out.
    - Better: simulate last-admin guard by creating admin C, then using C's token to
      attempt deleting the seeded admin AFTER deleting all extras except C. But the
      seeded admin is not C, so guard would only fire if total<=1. Skip that path
      and instead test: as admin C (token), try to delete the only-other-admin (seeded)
      while only 2 admins exist -> should succeed. Not what we want.
    - Final approach: create admin X, create admin Y. As X's token, delete seeded admin
      after deleting Y? No. Simpler: use X's token, count admins == 2 (X + seeded),
      delete X via seeded works fine (leaves seeded). To trigger last-admin guard, we
      need total_admins<=1 AND target != self. That's only possible if there is exactly
      1 admin and we try to delete that admin with a different admin's token, which
      is logically impossible.
    - Conclusion: the last-admin guard (count<=1) is unreachable in practice because
      to call DELETE you must be admin yourself. We document this and verify the code
      path exists by inspection. Test: ensure deleting the only other admin works and
      doesn't trigger guard, and that after deletion, deleting self still 400s with
      self-guard (not last-admin guard).
    """
    # Create admin A
    email_a = f"adminA.{uuid.uuid4().hex[:8]}@school.edu"
    ra = requests.post(f"{API}/admin/admins", headers=admin_h,
                      json={"email": email_a, "name": "A", "password": "Apass123"})
    assert ra.status_code == 200
    a_id = ra.json()["id"]

    # Create admin B
    email_b = f"adminB.{uuid.uuid4().hex[:8]}@school.edu"
    rb = requests.post(f"{API}/admin/admins", headers=admin_h,
                      json={"email": email_b, "name": "B", "password": "Bpass123"})
    assert rb.status_code == 200
    b_id = rb.json()["id"]

    # Delete A
    rdel = requests.delete(f"{API}/admin/admins/{a_id}", headers=admin_h)
    assert rdel.status_code == 200
    assert rdel.json().get("ok") is True

    # Confirm A removed
    rlist = requests.get(f"{API}/admin/admins", headers=admin_h)
    ids = [x["id"] for x in rlist.json()]
    assert a_id not in ids
    assert b_id in ids
    assert seeded_admin_id in ids

    # Self-deletion still blocked
    rself = requests.delete(f"{API}/admin/admins/{seeded_admin_id}", headers=admin_h)
    assert rself.status_code == 400

    # Cleanup: delete B as seeded admin
    rcleanup = requests.delete(f"{API}/admin/admins/{b_id}", headers=admin_h)
    assert rcleanup.status_code == 200


def test_delete_admin_requires_admin_auth(admin_h):
    # Create a target admin
    email = f"target.{uuid.uuid4().hex[:8]}@school.edu"
    r = requests.post(f"{API}/admin/admins", headers=admin_h,
                     json={"email": email, "name": "T", "password": "Tpass123"})
    target_id = r.json()["id"]

    # Anonymous
    ranon = requests.delete(f"{API}/admin/admins/{target_id}")
    assert ranon.status_code == 401

    # Student
    semail = f"stx.{uuid.uuid4().hex[:8]}@school.edu"
    rr = requests.post(f"{API}/auth/register", json={"email": semail, "password": "student123", "name": "S"})
    stok = rr.json()["token"]
    rstu = requests.delete(f"{API}/admin/admins/{target_id}",
                           headers={"Authorization": f"Bearer {stok}"})
    assert rstu.status_code == 403

    # Cleanup
    requests.delete(f"{API}/admin/admins/{target_id}", headers=admin_h)
