"""Backend tests for Campus Vote API."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vote-check.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "ltungcs2009@gmail.com"
ADMIN_PASS = "Lemmuel26Tungcul_"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- Auth ----------
def test_admin_login_and_me(admin_h):
    r = requests.get(f"{API}/auth/me", headers=admin_h)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_register_pending_when_not_in_voter_list():
    email = f"test.student+{uuid.uuid4().hex[:8]}@school.edu"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "Pending Student"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["status"] == "pending"
    assert data["user"]["role"] == "student"
    assert data["token"]


def test_voter_list_add_promotes_pending(admin_h):
    email = f"test.student+{uuid.uuid4().hex[:8]}@school.edu"
    # register first -> pending
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "Promote Me"})
    assert r.status_code == 200
    assert r.json()["user"]["status"] == "pending"
    # admin adds to voter list
    r2 = requests.post(f"{API}/admin/voter-list", headers=admin_h, json={"email": email, "name": "Promote Me"})
    assert r2.status_code == 200
    # login again, should be approved
    r3 = requests.post(f"{API}/auth/login", json={"email": email, "password": "student123"})
    assert r3.status_code == 200
    assert r3.json()["user"]["status"] == "approved"


def test_register_auto_approve_when_in_voter_list(admin_h):
    email = f"preload.{uuid.uuid4().hex[:8]}@school.edu"
    r = requests.post(f"{API}/admin/voter-list", headers=admin_h, json={"email": email, "name": "Pre"})
    assert r.status_code == 200
    r2 = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "Pre"})
    assert r2.status_code == 200
    assert r2.json()["user"]["status"] == "approved"


# ---------- Election + Candidate + Vote E2E ----------
@pytest.fixture(scope="session")
def election_setup(admin_h):
    # Create election with positions
    r = requests.post(f"{API}/elections", headers=admin_h, json={
        "title": f"TEST Election {uuid.uuid4().hex[:6]}",
        "description": "smoke",
        "positions": [{"title": "President"}, {"title": "Secretary"}],
    })
    assert r.status_code == 200, r.text
    election = r.json()
    assert election["status"] == "draft"
    assert len(election["positions"]) == 2
    eid = election["id"]
    pres_pid = election["positions"][0]["id"]

    # Add candidates
    r1 = requests.post(f"{API}/elections/{eid}/candidates", headers=admin_h,
                       json={"name": "Alice", "position_id": pres_pid})
    assert r1.status_code == 200
    cand_a = r1.json()
    r2 = requests.post(f"{API}/elections/{eid}/candidates", headers=admin_h,
                       json={"name": "Bob", "position_id": pres_pid})
    assert r2.status_code == 200
    cand_b = r2.json()

    # Reject invalid position id
    rbad = requests.post(f"{API}/elections/{eid}/candidates", headers=admin_h,
                        json={"name": "Bad", "position_id": "no-such"})
    assert rbad.status_code == 400

    return {"eid": eid, "pres_pid": pres_pid, "cand_a": cand_a["id"], "cand_b": cand_b["id"]}


def test_non_admin_cannot_create_election():
    # register a fresh student
    email = f"stud.{uuid.uuid4().hex[:8]}@school.edu"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "S"})
    tok = r.json()["token"]
    r2 = requests.post(f"{API}/elections", headers={"Authorization": f"Bearer {tok}"},
                       json={"title": "x", "positions": [{"title": "p"}]})
    assert r2.status_code == 403


def test_student_cannot_see_draft_election(election_setup):
    email = f"stud.{uuid.uuid4().hex[:8]}@school.edu"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "S"})
    tok = r.json()["token"]
    r2 = requests.get(f"{API}/elections", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    ids = [e["id"] for e in r2.json()]
    assert election_setup["eid"] not in ids  # still draft


def test_student_cannot_patch_election(election_setup):
    email = f"stud.{uuid.uuid4().hex[:8]}@school.edu"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "S"})
    tok = r.json()["token"]
    r2 = requests.patch(f"{API}/elections/{election_setup['eid']}",
                        headers={"Authorization": f"Bearer {tok}"}, json={"status": "active"})
    assert r2.status_code == 403


def test_activate_election(admin_h, election_setup):
    r = requests.patch(f"{API}/elections/{election_setup['eid']}", headers=admin_h, json={"status": "active"})
    assert r.status_code == 200
    assert r.json()["status"] == "active"


def test_pending_student_cannot_vote(election_setup):
    email = f"pending.{uuid.uuid4().hex[:8]}@school.edu"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "P"})
    tok = r.json()["token"]
    r2 = requests.post(f"{API}/elections/{election_setup['eid']}/vote",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"selections": [{"position_id": election_setup["pres_pid"], "candidate_id": election_setup["cand_a"]}]})
    assert r2.status_code == 403


@pytest.fixture(scope="session")
def approved_student(admin_h):
    email = f"approved.{uuid.uuid4().hex[:8]}@school.edu"
    requests.post(f"{API}/admin/voter-list", headers=admin_h, json={"email": email, "name": "A"})
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "A"})
    assert r.json()["user"]["status"] == "approved"
    return {"token": r.json()["token"], "email": email, "id": r.json()["user"]["id"]}


def test_approved_student_can_vote(election_setup, approved_student):
    h = {"Authorization": f"Bearer {approved_student['token']}"}
    payload = {
        "selections": [{"position_id": election_setup["pres_pid"], "candidate_id": election_setup["cand_a"]}],
        "client_id": "client-abc-123",
    }
    r = requests.post(f"{API}/elections/{election_setup['eid']}/vote", headers=h, json=payload)
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True


def test_vote_idempotency_same_client_id(election_setup, approved_student):
    h = {"Authorization": f"Bearer {approved_student['token']}"}
    payload = {
        "selections": [{"position_id": election_setup["pres_pid"], "candidate_id": election_setup["cand_a"]}],
        "client_id": "client-abc-123",
    }
    r = requests.post(f"{API}/elections/{election_setup['eid']}/vote", headers=h, json=payload)
    assert r.status_code == 200
    assert r.json().get("already_recorded") is True


def test_duplicate_vote_rejected(election_setup, approved_student):
    h = {"Authorization": f"Bearer {approved_student['token']}"}
    payload = {"selections": [{"position_id": election_setup["pres_pid"], "candidate_id": election_setup["cand_b"]}]}
    r = requests.post(f"{API}/elections/{election_setup['eid']}/vote", headers=h, json=payload)
    assert r.status_code == 400


def test_results_admin_only(admin_h, election_setup, approved_student):
    r = requests.get(f"{API}/elections/{election_setup['eid']}/results", headers=admin_h)
    assert r.status_code == 200
    data = r.json()
    assert data["total_votes"] >= 1
    assert "turnout_pct" in data
    # student denied
    r2 = requests.get(f"{API}/elections/{election_setup['eid']}/results",
                     headers={"Authorization": f"Bearer {approved_student['token']}"})
    assert r2.status_code == 403


def test_admin_stats(admin_h):
    r = requests.get(f"{API}/admin/stats", headers=admin_h)
    assert r.status_code == 200
    j = r.json()
    assert "students" in j and "elections" in j


def test_voter_management_patch_and_delete(admin_h):
    email = f"manage.{uuid.uuid4().hex[:8]}@school.edu"
    rr = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "M"})
    uid = rr.json()["user"]["id"]
    r = requests.patch(f"{API}/admin/voters/{uid}", headers=admin_h, json={"status": "rejected"})
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    r2 = requests.delete(f"{API}/admin/voters/{uid}", headers=admin_h)
    assert r2.status_code == 200


def test_bulk_voter_list(admin_h):
    emails = [f"bulk.{uuid.uuid4().hex[:6]}@school.edu" for _ in range(3)]
    r = requests.post(f"{API}/admin/voter-list/bulk", headers=admin_h,
                      json={"voters": [{"email": e} for e in emails]})
    assert r.status_code == 200
    assert r.json()["added"] == 3


def test_close_election_blocks_voting(admin_h, election_setup):
    r = requests.patch(f"{API}/elections/{election_setup['eid']}", headers=admin_h, json={"status": "closed"})
    assert r.status_code == 200
    # new student tries to vote -> rejected (not active)
    email = f"late.{uuid.uuid4().hex[:8]}@school.edu"
    requests.post(f"{API}/admin/voter-list", headers=admin_h, json={"email": email})
    rr = requests.post(f"{API}/auth/register", json={"email": email, "password": "student123", "name": "L"})
    tok = rr.json()["token"]
    r2 = requests.post(f"{API}/elections/{election_setup['eid']}/vote",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"selections": [{"position_id": election_setup["pres_pid"], "candidate_id": election_setup["cand_a"]}]})
    assert r2.status_code == 400
