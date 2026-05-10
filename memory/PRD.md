# CampusVote — Product Requirements Document

## Original Problem Statement
Build a simple, minimal, student-friendly voting/election application with a clean and easy-to-navigate interface. Admins manage the voting process and candidates within the same system. Focus on accessibility, smooth navigation, and a modern yet lightweight design suitable for students.

## User Choices (Locked-in)
- **Auth**: JWT-based custom auth (email + password)
- **Election scope**: Multiple elections / positions
- **Voter verification**: BOTH (admin pre-loads roster -> auto-approve, OR admin manually approves pending sign-ups)
- **Offline support**: Basic — votes queued in localStorage, synced on reconnect
- **Admin seeded from .env**: ltungcs2009@gmail.com / Lemmuel26Tungcul_ (ADMIN_TEST)
- **Admin promotion**: Admin creates new admin accounts directly with a password (no student promotion)

## Architecture
- FastAPI + MongoDB (motor) + bcrypt + PyJWT (Bearer token only)
- React (CRA + craco) + Tailwind + shadcn UI + sonner + lucide-react
- Pastel academic theme (Outfit headings, Work Sans body, muted blue primary)

## Personas
- **Admin** — runs elections, manages voters, candidates, results, other admins
- **Student / Voter** — registers, gets verified, casts a single vote per election (offline-tolerant)

## Implemented (2026-05-10)
### Backend
- POST/GET /api/auth/{register,login,me,logout} — register accepts `section_id` (required when sections exist); user gets `year_level` + `section_name` stamped from chosen section
- /api/sections (public GET); /api/admin/sections (POST/DELETE; admin-only; in-use guard)
- /api/elections CRUD with **position scope** (`school` | `year`); year-scope positions filter candidates per voter
- /api/elections/{id}/candidates CRUD with `year_level` validation (required for year-scope; null for school-scope)
- /api/elections/{id}/vote — server validates scope match (rejects voting outside one's year), stamps `section_id`/`section_name`/`year_level` on the vote doc; one vote per voter+election; idempotent via client_id
- /api/elections/{id}/results — overall tally + `sections` list + `section_totals` + per-candidate `by_section` breakdown
- /api/admin/voters list/PATCH/DELETE; /api/admin/voter-list list/POST/bulk/DELETE
- /api/admin/admins list/POST/DELETE (self/last-admin guards)
- /api/admin/stats; GET /api/settings + PATCH /api/admin/settings (branding)
- Admin seeded from env on startup

### Frontend
- Landing, Login, Register (registration grouped Year-level + Section selector)
- Student Dashboard (year-level/section badge), Vote page (server-filtered candidates per year), offline queue + sync
- Admin Dashboard, Elections list + detail (per-position scope toggle, candidate year-level field), Voters, Sections, Admins, Settings, Live Results (overall + per-section breakdown table)
- Shared `<BrandMark />` with `BrandProvider` — brand updates live
- Offline banner with auto-sync

## Tests
- /app/backend/tests/backend_test.py (18/18 pass)
- /app/backend/tests/test_admin_management.py (13/13 pass)
- Frontend smoke for admin user-management: 100% pass

## Backlog
### P0 (next)
- Brute-force lockout on /api/auth/login (5 fails / 15 min)
- "Change my password" + "show/hide" toggle in admin create dialog
### P1
- Promote existing student to admin
- Audit log of admin create/delete actions
- Election scheduling (auto open/close on dates)
- CSV export of results / voters
### P2
- Service-worker PWA (full offline-first asset caching)
- Email-based password reset
- Two-factor auth for admins
