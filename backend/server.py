from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# ----- Setup -----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_DAYS = 7

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("campus-vote")

app = FastAPI(title="Campus Vote API")
api = APIRouter(prefix="/api")


# ----- Helpers -----
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now_utc() + timedelta(days=ACCESS_TOKEN_DAYS),
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _get_token(request: Request) -> Optional[str]:
    token = request.cookies.get("access_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


async def get_current_user(request: Request) -> dict:
    token = _get_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_approved_voter(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") == "admin":
        return user
    if user.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Your account is pending verification by an admin")
    return user


# ----- Models -----
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)
    student_id: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    status: str
    student_id: Optional[str] = None
    created_at: str

class PositionIn(BaseModel):
    title: str
    description: Optional[str] = ""

class Position(PositionIn):
    id: str

class ElectionIn(BaseModel):
    title: str
    description: Optional[str] = ""
    positions: List[PositionIn] = []

class ElectionPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["draft", "active", "closed"]] = None
    positions: Optional[List[PositionIn]] = None

class CandidateIn(BaseModel):
    name: str
    bio: Optional[str] = ""
    photo_url: Optional[str] = ""
    position_id: str

class CandidatePatch(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    position_id: Optional[str] = None

class VoteSelection(BaseModel):
    position_id: str
    candidate_id: str

class VoteIn(BaseModel):
    selections: List[VoteSelection]
    client_id: Optional[str] = None  # for offline dedup

class VoterListIn(BaseModel):
    email: EmailStr
    name: Optional[str] = ""
    student_id: Optional[str] = ""

class VoterListBulkIn(BaseModel):
    voters: List[VoterListIn]

class VoterStatusPatch(BaseModel):
    status: Literal["approved", "rejected", "pending"]


class BrandIn(BaseModel):
    name: Optional[str] = Field(default=None, max_length=60)
    logo_url: Optional[str] = Field(default=None, max_length=2048)


# ----- Cookie helper -----
def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_DAYS * 24 * 3600,
        path="/",
    )

def clear_auth_cookie(response: Response):
    response.delete_cookie(key="access_token", path="/")


# ----- Auth routes -----
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email is already registered")

    # Check if pre-loaded in voter_list -> auto approve
    preload = await db.voter_list.find_one({"email": email})
    status = "approved" if preload else "pending"

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "role": "student",
        "status": status,
        "student_id": (body.student_id or (preload.get("student_id") if preload else "") or "").strip(),
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, "student")
    set_auth_cookie(response, token)
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"user": user_doc, "token": token}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["role"])
    set_auth_cookie(response, token)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ----- Election routes -----
@api.get("/elections")
async def list_elections(user: dict = Depends(get_current_user)):
    elections = await db.elections.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Students see only active/closed; admins see all
    if user["role"] != "admin":
        elections = [e for e in elections if e.get("status") in ("active", "closed")]
    # attach has_voted flag for students
    for e in elections:
        if user["role"] != "admin":
            v = await db.votes.find_one({"voter_id": user["id"], "election_id": e["id"]})
            e["has_voted"] = bool(v)
        # candidate count
        e["candidate_count"] = await db.candidates.count_documents({"election_id": e["id"]})
    return elections


@api.post("/elections")
async def create_election(body: ElectionIn, _: dict = Depends(require_admin)):
    eid = str(uuid.uuid4())
    positions = [{"id": str(uuid.uuid4()), "title": p.title, "description": p.description or ""} for p in body.positions]
    doc = {
        "id": eid,
        "title": body.title,
        "description": body.description or "",
        "status": "draft",
        "positions": positions,
        "created_at": now_utc().isoformat(),
    }
    await db.elections.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/elections/{election_id}")
async def get_election(election_id: str, user: dict = Depends(get_current_user)):
    e = await db.elections.find_one({"id": election_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Election not found")
    if user["role"] != "admin" and e.get("status") not in ("active", "closed"):
        raise HTTPException(status_code=404, detail="Election not found")
    candidates = await db.candidates.find({"election_id": election_id}, {"_id": 0}).to_list(1000)
    e["candidates"] = candidates
    if user["role"] != "admin":
        v = await db.votes.find_one({"voter_id": user["id"], "election_id": election_id})
        e["has_voted"] = bool(v)
    return e


@api.patch("/elections/{election_id}")
async def update_election(election_id: str, body: ElectionPatch, _: dict = Depends(require_admin)):
    e = await db.elections.find_one({"id": election_id})
    if not e:
        raise HTTPException(status_code=404, detail="Election not found")
    update = {}
    if body.title is not None:
        update["title"] = body.title
    if body.description is not None:
        update["description"] = body.description
    if body.status is not None:
        update["status"] = body.status
    if body.positions is not None:
        # preserve existing position IDs by title match where possible
        existing = {p["title"]: p["id"] for p in e.get("positions", [])}
        new_positions = []
        for p in body.positions:
            new_positions.append({
                "id": existing.get(p.title, str(uuid.uuid4())),
                "title": p.title,
                "description": p.description or "",
            })
        update["positions"] = new_positions
    if update:
        await db.elections.update_one({"id": election_id}, {"$set": update})
    out = await db.elections.find_one({"id": election_id}, {"_id": 0})
    return out


@api.delete("/elections/{election_id}")
async def delete_election(election_id: str, _: dict = Depends(require_admin)):
    await db.elections.delete_one({"id": election_id})
    await db.candidates.delete_many({"election_id": election_id})
    await db.votes.delete_many({"election_id": election_id})
    return {"ok": True}


# ----- Candidate routes -----
@api.get("/elections/{election_id}/candidates")
async def list_candidates(election_id: str, user: dict = Depends(get_current_user)):
    candidates = await db.candidates.find({"election_id": election_id}, {"_id": 0}).to_list(1000)
    return candidates


@api.post("/elections/{election_id}/candidates")
async def create_candidate(election_id: str, body: CandidateIn, _: dict = Depends(require_admin)):
    e = await db.elections.find_one({"id": election_id})
    if not e:
        raise HTTPException(status_code=404, detail="Election not found")
    pos_ids = {p["id"] for p in e.get("positions", [])}
    if body.position_id not in pos_ids:
        raise HTTPException(status_code=400, detail="Invalid position_id for this election")
    cid = str(uuid.uuid4())
    doc = {
        "id": cid,
        "election_id": election_id,
        "position_id": body.position_id,
        "name": body.name,
        "bio": body.bio or "",
        "photo_url": body.photo_url or "",
        "created_at": now_utc().isoformat(),
    }
    await db.candidates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/candidates/{candidate_id}")
async def update_candidate(candidate_id: str, body: CandidatePatch, _: dict = Depends(require_admin)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if update:
        await db.candidates.update_one({"id": candidate_id}, {"$set": update})
    out = await db.candidates.find_one({"id": candidate_id}, {"_id": 0})
    if not out:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return out


@api.delete("/candidates/{candidate_id}")
async def delete_candidate(candidate_id: str, _: dict = Depends(require_admin)):
    await db.candidates.delete_one({"id": candidate_id})
    return {"ok": True}


# ----- Voting -----
@api.post("/elections/{election_id}/vote")
async def cast_vote(election_id: str, body: VoteIn, user: dict = Depends(require_approved_voter)):
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Admins cannot cast votes")

    e = await db.elections.find_one({"id": election_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Election not found")
    if e.get("status") != "active":
        raise HTTPException(status_code=400, detail="Election is not currently active")

    # Idempotency: if same client_id already accepted, return ok
    if body.client_id:
        existing = await db.votes.find_one({"client_id": body.client_id, "voter_id": user["id"]})
        if existing:
            return {"ok": True, "already_recorded": True}

    if await db.votes.find_one({"voter_id": user["id"], "election_id": election_id}):
        raise HTTPException(status_code=400, detail="You have already voted in this election")

    pos_ids = {p["id"] for p in e.get("positions", [])}
    candidate_ids = {c["id"]: c["position_id"] for c in await db.candidates.find({"election_id": election_id}, {"_id": 0}).to_list(2000)}

    seen_positions = set()
    for sel in body.selections:
        if sel.position_id not in pos_ids:
            raise HTTPException(status_code=400, detail="Invalid position_id")
        if sel.position_id in seen_positions:
            raise HTTPException(status_code=400, detail="Duplicate selection for a single position")
        seen_positions.add(sel.position_id)
        if candidate_ids.get(sel.candidate_id) != sel.position_id:
            raise HTTPException(status_code=400, detail="Candidate does not match position")

    vote_doc = {
        "id": str(uuid.uuid4()),
        "voter_id": user["id"],
        "election_id": election_id,
        "selections": [s.model_dump() for s in body.selections],
        "client_id": body.client_id,
        "created_at": now_utc().isoformat(),
    }
    await db.votes.insert_one(vote_doc)
    return {"ok": True}


# ----- Results -----
@api.get("/elections/{election_id}/results")
async def get_results(election_id: str, _: dict = Depends(require_admin)):
    e = await db.elections.find_one({"id": election_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Election not found")
    candidates = await db.candidates.find({"election_id": election_id}, {"_id": 0}).to_list(2000)
    cand_by_id = {c["id"]: c for c in candidates}

    tallies = {}  # position_id -> { candidate_id -> count }
    for p in e.get("positions", []):
        tallies[p["id"]] = {c["id"]: 0 for c in candidates if c["position_id"] == p["id"]}

    total_votes = 0
    async for v in db.votes.find({"election_id": election_id}, {"_id": 0}):
        total_votes += 1
        for sel in v.get("selections", []):
            if sel["position_id"] in tallies and sel["candidate_id"] in tallies[sel["position_id"]]:
                tallies[sel["position_id"]][sel["candidate_id"]] += 1

    results = []
    for p in e.get("positions", []):
        rows = []
        for cid, count in tallies.get(p["id"], {}).items():
            cand = cand_by_id.get(cid, {})
            rows.append({"candidate_id": cid, "name": cand.get("name", "Unknown"), "votes": count})
        rows.sort(key=lambda x: x["votes"], reverse=True)
        results.append({"position_id": p["id"], "title": p["title"], "candidates": rows})

    total_eligible = await db.users.count_documents({"role": "student", "status": "approved"})
    return {
        "election": {"id": e["id"], "title": e["title"], "status": e["status"]},
        "total_votes": total_votes,
        "total_eligible": total_eligible,
        "turnout_pct": round((total_votes / total_eligible) * 100, 2) if total_eligible else 0,
        "positions": results,
    }


# ----- Voter management -----
@api.get("/admin/voters")
async def list_voters(_: dict = Depends(require_admin)):
    users = await db.users.find({"role": "student"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(2000)
    return users


@api.patch("/admin/voters/{user_id}")
async def patch_voter(user_id: str, body: VoterStatusPatch, _: dict = Depends(require_admin)):
    res = await db.users.update_one({"id": user_id, "role": "student"}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Voter not found")
    out = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return out


@api.delete("/admin/voters/{user_id}")
async def delete_voter(user_id: str, _: dict = Depends(require_admin)):
    await db.users.delete_one({"id": user_id, "role": "student"})
    await db.votes.delete_many({"voter_id": user_id})
    return {"ok": True}


@api.get("/admin/voter-list")
async def get_voter_list(_: dict = Depends(require_admin)):
    items = await db.voter_list.find({}, {"_id": 0}).sort("email", 1).to_list(5000)
    return items


@api.post("/admin/voter-list")
async def add_to_voter_list(body: VoterListIn, _: dict = Depends(require_admin)):
    email = body.email.lower().strip()
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name or "",
        "student_id": body.student_id or "",
        "added_at": now_utc().isoformat(),
    }
    await db.voter_list.update_one({"email": email}, {"$set": doc}, upsert=True)
    # If a user already registered with this email and is pending -> auto approve
    await db.users.update_one(
        {"email": email, "role": "student", "status": "pending"},
        {"$set": {"status": "approved"}},
    )
    return doc


@api.post("/admin/voter-list/bulk")
async def bulk_add_voter_list(body: VoterListBulkIn, _: dict = Depends(require_admin)):
    added = 0
    for v in body.voters:
        email = v.email.lower().strip()
        await db.voter_list.update_one(
            {"email": email},
            {"$set": {
                "id": str(uuid.uuid4()),
                "email": email,
                "name": v.name or "",
                "student_id": v.student_id or "",
                "added_at": now_utc().isoformat(),
            }},
            upsert=True,
        )
        await db.users.update_one(
            {"email": email, "role": "student", "status": "pending"},
            {"$set": {"status": "approved"}},
        )
        added += 1
    return {"ok": True, "added": added}


@api.delete("/admin/voter-list/{entry_id}")
async def remove_voter_list(entry_id: str, _: dict = Depends(require_admin)):
    await db.voter_list.delete_one({"id": entry_id})
    return {"ok": True}


# ----- Admin user management -----
class AdminCreateIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=6)


@api.get("/admin/admins")
async def list_admins(_: dict = Depends(require_admin)):
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(500)
    return admins


@api.post("/admin/admins")
async def create_admin(body: AdminCreateIn, _: dict = Depends(require_admin)):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "role": "admin",
        "status": "approved",
        "student_id": "",
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


@api.delete("/admin/admins/{user_id}")
async def delete_admin(user_id: str, current: dict = Depends(require_admin)):
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="You cannot remove your own admin account")
    target = await db.users.find_one({"id": user_id, "role": "admin"})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    total_admins = await db.users.count_documents({"role": "admin"})
    if total_admins <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove the last remaining admin")
    await db.users.delete_one({"id": user_id, "role": "admin"})
    return {"ok": True}


# ----- Branding (public read, admin write) -----
DEFAULT_BRAND = {"name": "CampusVote", "logo_url": ""}


async def get_brand_doc() -> dict:
    doc = await db.settings.find_one({"key": "brand"}, {"_id": 0})
    if not doc:
        return {**DEFAULT_BRAND, "key": "brand", "updated_at": None}
    return {**DEFAULT_BRAND, **doc}


@api.get("/settings")
async def get_settings():
    doc = await get_brand_doc()
    return {"name": doc.get("name") or DEFAULT_BRAND["name"], "logo_url": doc.get("logo_url") or ""}


@api.patch("/admin/settings")
async def update_settings(body: BrandIn, _: dict = Depends(require_admin)):
    update = {}
    if body.name is not None:
        clean = body.name.strip()
        if not clean:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        update["name"] = clean
    if body.logo_url is not None:
        update["logo_url"] = body.logo_url.strip()
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = now_utc().isoformat()
    await db.settings.update_one({"key": "brand"}, {"$set": update}, upsert=True)
    doc = await get_brand_doc()
    return {"name": doc.get("name") or DEFAULT_BRAND["name"], "logo_url": doc.get("logo_url") or ""}


# ----- Stats -----
@api.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    total_students = await db.users.count_documents({"role": "student"})
    approved = await db.users.count_documents({"role": "student", "status": "approved"})
    pending = await db.users.count_documents({"role": "student", "status": "pending"})
    rejected = await db.users.count_documents({"role": "student", "status": "rejected"})
    elections_total = await db.elections.count_documents({})
    elections_active = await db.elections.count_documents({"status": "active"})
    candidates_total = await db.candidates.count_documents({})
    votes_total = await db.votes.count_documents({})
    return {
        "students": {"total": total_students, "approved": approved, "pending": pending, "rejected": rejected},
        "elections": {"total": elections_total, "active": elections_active},
        "candidates": candidates_total,
        "votes": votes_total,
    }


@api.get("/")
async def root():
    return {"service": "campus-vote", "ok": True}


# ----- Startup -----
async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower().strip()
    password = os.environ["ADMIN_PASSWORD"]
    name = os.environ.get("ADMIN_NAME", "Admin")
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "password_hash": hash_password(password),
            "role": "admin",
            "status": "approved",
            "student_id": "",
            "created_at": now_utc().isoformat(),
        })
        logger.info("Seeded admin: %s", email)
    else:
        update = {}
        if not verify_password(password, existing["password_hash"]):
            update["password_hash"] = hash_password(password)
        if existing.get("role") != "admin":
            update["role"] = "admin"
        if update:
            await db.users.update_one({"email": email}, {"$set": update})
            logger.info("Refreshed admin: %s", email)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.voter_list.create_index("email", unique=True)
    await db.elections.create_index("id", unique=True)
    await db.candidates.create_index("id", unique=True)
    await db.candidates.create_index("election_id")
    await db.votes.create_index([("voter_id", 1), ("election_id", 1)], unique=True)
    await db.votes.create_index("client_id")
    await seed_admin()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
