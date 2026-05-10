"""Backend tests for the new year-level + section feature."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vote-check.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "ltungcs2009@gmail.com"
ADMIN_PASS = "Lemmuel26Tungcul_"


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def existing_sections():
    """Return a dict mapping (year_level, name) -> section dict for sections that already exist."""
    r = requests.get(f"{API}/sections")
    assert r.status_code == 200
    return {(s["year_level"], s["name"]): s for s in r.json()}


@pytest.fixture(scope="module")
def grade11_section(existing_sections):
    sec = existing_sections.get(("Grade 11", "Einstein")) or existing_sections.get(("Grade 11", "Newton"))
    if not sec:
        pytest.skip("No Grade 11 section found in seed")
    return sec


@pytest.fixture(scope="module")
def grade12_section(existing_sections):
    sec = existing_sections.get(("Grade 12", "Curie"))
    if not sec:
        pytest.skip("No Grade 12 section found in seed")
    return sec


def _register_student(section_id=None, name="Student", password="student123"):
    email = f"sectest.{uuid.uuid4().hex[:8]}@school.edu"
    body = {"email": email, "password": password, "name": name}
    if section_id is not None:
        body["section_id"] = section_id
    r = requests.post(f"{API}/auth/register", json=body)
    return r, email


# ---------- Section CRUD + auth ----------
def test_get_sections_public_no_auth():
    r = requests.get(f"{API}/sections")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        assert {"id", "year_level", "name"}.issubset(data[0].keys())


def test_create_section_requires_admin_anon():
    r = requests.post(f"{API}/admin/sections", json={"year_level": "X", "name": "Y"})
    assert r.status_code == 401


def test_create_section_requires_admin_student(admin_h, grade11_section):
    r, _ = _register_student(section_id=grade11_section["id"])
    assert r.status_code == 200
    tok = r.json()["token"]
    r2 = requests.post(f"{API}/admin/sections", headers={"Authorization": f"Bearer {tok}"},
                       json={"year_level": "X", "name": "Y"})
    assert r2.status_code == 403


def test_create_and_delete_section(admin_h):
    name = f"TEST_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/admin/sections", headers=admin_h,
                      json={"year_level": "Grade 7", "name": name})
    assert r.status_code == 200, r.text
    sec = r.json()
    assert sec["year_level"] == "Grade 7"
    assert sec["name"] == name
    assert "id" in sec

    # appears in public list
    pub = requests.get(f"{API}/sections").json()
    assert any(s["id"] == sec["id"] for s in pub)

    # duplicate -> 400
    r_dup = requests.post(f"{API}/admin/sections", headers=admin_h,
                          json={"year_level": "Grade 7", "name": name})
    assert r_dup.status_code == 400

    # delete
    r_del = requests.delete(f"{API}/admin/sections/{sec['id']}", headers=admin_h)
    assert r_del.status_code == 200

    # delete unknown -> 404
    r_404 = requests.delete(f"{API}/admin/sections/nonexistent-{uuid.uuid4().hex}", headers=admin_h)
    assert r_404.status_code == 404


def test_delete_section_in_use_blocked(admin_h):
    # Create a section, attach a student, then attempt delete -> 400
    name = f"INUSE_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/admin/sections", headers=admin_h,
                      json={"year_level": "Grade 8", "name": name})
    assert r.status_code == 200
    sec = r.json()
    rr, _ = _register_student(section_id=sec["id"])
    assert rr.status_code == 200
    r_del = requests.delete(f"{API}/admin/sections/{sec['id']}", headers=admin_h)
    assert r_del.status_code == 400


# ---------- Register requires section_id when sections exist ----------
def test_register_missing_section_blocked():
    r, _ = _register_student(section_id=None)
    assert r.status_code == 400
    assert "section" in r.text.lower()


def test_register_invalid_section_blocked():
    r, _ = _register_student(section_id="bogus-id-xxxx")
    assert r.status_code == 400


def test_register_with_section_populates_year_and_name(grade11_section):
    r, _ = _register_student(section_id=grade11_section["id"])
    assert r.status_code == 200
    user = r.json()["user"]
    assert user["section_id"] == grade11_section["id"]
    assert user["year_level"] == grade11_section["year_level"]
    assert user["section_name"] == grade11_section["name"]


# ---------- Election scope + candidate year_level ----------
@pytest.fixture(scope="module")
def scoped_election(admin_h):
    r = requests.post(f"{API}/elections", headers=admin_h, json={
        "title": f"TEST Scoped {uuid.uuid4().hex[:6]}",
        "positions": [
            {"title": "President", "scope": "school"},
            {"title": "G11 Rep", "scope": "year"},
        ],
    })
    assert r.status_code == 200, r.text
    e = r.json()
    assert len(e["positions"]) == 2
    assert e["positions"][0]["scope"] == "school"
    assert e["positions"][1]["scope"] == "year"
    return e


def test_create_election_default_scope_is_school(admin_h):
    r = requests.post(f"{API}/elections", headers=admin_h, json={
        "title": f"TEST Default {uuid.uuid4().hex[:6]}",
        "positions": [{"title": "P1"}],
    })
    assert r.status_code == 200
    assert r.json()["positions"][0]["scope"] == "school"


def test_patch_preserves_scope(admin_h, scoped_election):
    eid = scoped_election["id"]
    # repeat positions list - PATCH should preserve scope
    new_positions = [
        {"title": "President", "scope": "school"},
        {"title": "G11 Rep", "scope": "year"},
    ]
    r = requests.patch(f"{API}/elections/{eid}", headers=admin_h, json={"positions": new_positions})
    assert r.status_code == 200
    out = r.json()
    by_title = {p["title"]: p for p in out["positions"]}
    assert by_title["President"]["scope"] == "school"
    assert by_title["G11 Rep"]["scope"] == "year"


def test_year_position_requires_year_level_on_candidate(admin_h, scoped_election):
    eid = scoped_election["id"]
    year_pid = next(p["id"] for p in scoped_election["positions"] if p["scope"] == "year")
    r = requests.post(f"{API}/elections/{eid}/candidates", headers=admin_h,
                      json={"name": "NoYear", "position_id": year_pid})
    assert r.status_code == 400


def test_school_position_stores_null_year_level(admin_h, scoped_election):
    eid = scoped_election["id"]
    school_pid = next(p["id"] for p in scoped_election["positions"] if p["scope"] == "school")
    r = requests.post(f"{API}/elections/{eid}/candidates", headers=admin_h,
                      json={"name": "SchoolCand", "position_id": school_pid, "year_level": "Grade 11"})
    assert r.status_code == 200
    assert r.json()["year_level"] is None  # backend sets to None for school scope


@pytest.fixture(scope="module")
def scoped_candidates(admin_h, scoped_election):
    eid = scoped_election["id"]
    school_pid = next(p["id"] for p in scoped_election["positions"] if p["scope"] == "school")
    year_pid = next(p["id"] for p in scoped_election["positions"] if p["scope"] == "year")
    # school
    s_cand = requests.post(f"{API}/elections/{eid}/candidates", headers=admin_h,
                           json={"name": "S_Pres_A", "position_id": school_pid}).json()
    # G11
    g11_cand = requests.post(f"{API}/elections/{eid}/candidates", headers=admin_h,
                             json={"name": "G11_Rep_A", "position_id": year_pid, "year_level": "Grade 11"}).json()
    # G12
    g12_cand = requests.post(f"{API}/elections/{eid}/candidates", headers=admin_h,
                             json={"name": "G12_Rep_X", "position_id": year_pid, "year_level": "Grade 12"}).json()
    # activate
    requests.patch(f"{API}/elections/{eid}", headers=admin_h, json={"status": "active"})
    return {"eid": eid, "school_pid": school_pid, "year_pid": year_pid,
            "school": s_cand, "g11": g11_cand, "g12": g12_cand}


# ---------- Per-voter candidate filtering ----------
def test_get_election_filters_year_for_student(admin_h, grade11_section, scoped_candidates):
    # Approve a Grade 11 student
    email = f"g11.{uuid.uuid4().hex[:8]}@school.edu"
    requests.post(f"{API}/admin/voter-list", headers=admin_h, json={"email": email})
    rr = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "student123", "name": "G11", "section_id": grade11_section["id"]
    })
    assert rr.status_code == 200
    tok = rr.json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    r = requests.get(f"{API}/elections/{scoped_candidates['eid']}", headers=h)
    assert r.status_code == 200
    cand_names = {c["name"] for c in r.json()["candidates"]}
    assert "S_Pres_A" in cand_names           # school -> visible
    assert "G11_Rep_A" in cand_names          # year matches
    assert "G12_Rep_X" not in cand_names      # year mismatch filtered out
    return {"token": tok, "h": h}


def test_get_election_admin_sees_all(admin_h, scoped_candidates):
    r = requests.get(f"{API}/elections/{scoped_candidates['eid']}", headers=admin_h)
    assert r.status_code == 200
    cand_names = {c["name"] for c in r.json()["candidates"]}
    assert {"S_Pres_A", "G11_Rep_A", "G12_Rep_X"}.issubset(cand_names)


# ---------- Vote scope guard + vote stamping + results ----------
def test_vote_scope_guard_rejects_year_mismatch(admin_h, grade11_section, scoped_candidates):
    # G11 student tries to vote G12 candidate in year-scope position -> 400
    email = f"g11v.{uuid.uuid4().hex[:8]}@school.edu"
    requests.post(f"{API}/admin/voter-list", headers=admin_h, json={"email": email})
    rr = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "student123", "name": "G11V", "section_id": grade11_section["id"]
    })
    tok = rr.json()["token"]
    sc = scoped_candidates
    payload = {"selections": [
        {"position_id": sc["school_pid"], "candidate_id": sc["school"]["id"]},
        {"position_id": sc["year_pid"], "candidate_id": sc["g12"]["id"]},  # mismatch
    ]}
    r = requests.post(f"{API}/elections/{sc['eid']}/vote",
                      headers={"Authorization": f"Bearer {tok}"}, json=payload)
    assert r.status_code == 400


def test_vote_success_stamps_section_and_results(admin_h, grade11_section, scoped_candidates):
    email = f"g11ok.{uuid.uuid4().hex[:8]}@school.edu"
    requests.post(f"{API}/admin/voter-list", headers=admin_h, json={"email": email})
    rr = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "student123", "name": "G11OK", "section_id": grade11_section["id"]
    })
    tok = rr.json()["token"]
    sc = scoped_candidates
    payload = {"selections": [
        {"position_id": sc["school_pid"], "candidate_id": sc["school"]["id"]},
        {"position_id": sc["year_pid"], "candidate_id": sc["g11"]["id"]},
    ]}
    r = requests.post(f"{API}/elections/{sc['eid']}/vote",
                      headers={"Authorization": f"Bearer {tok}"}, json=payload)
    assert r.status_code == 200, r.text

    # Results: sections array, section_totals, by_section per candidate
    rr = requests.get(f"{API}/elections/{sc['eid']}/results", headers=admin_h)
    assert rr.status_code == 200
    data = rr.json()
    assert "sections" in data and isinstance(data["sections"], list)
    assert "section_totals" in data and isinstance(data["section_totals"], dict)
    expected_label = f"{grade11_section['year_level']} \u2014 {grade11_section['name']}"
    assert expected_label in data["sections"], f"label missing: {expected_label} in {data['sections']}"
    assert data["section_totals"].get(expected_label, 0) >= 1
    # check by_section breakdown
    found = False
    for pos in data["positions"]:
        for c in pos["candidates"]:
            if c["candidate_id"] == sc["g11"]["id"]:
                assert c["by_section"].get(expected_label, 0) >= 1
                found = True
    assert found
