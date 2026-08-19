# Student, Group & Assignment Management System

Role-based full-stack app for Joineazy: students form groups, manage members, and confirm assignment submissions via a two-step flow; educators post assignments, target them at students or groups, and track completion.

## Stack
React.js + Tailwind CSS · Node.js + Express · PostgreSQL · Docker · pnpm · JWT auth · Brevo (transactional email)

## Setup & Run (Local)

Requires: Docker, Docker Compose, pnpm (`corepack enable` if using Node 20+, or `npm i -g pnpm`).

```bash
git clone <repo-url>
cd <repo>
cp .env.example .env
# fill in .env — see docs/deployment.md for full variable list
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api/v1`
- Postgres: `localhost:5432`

Run migrations (first boot only):
```bash
docker compose exec backend pnpm run migrate
```

## Repo Structure
```
backend/     Express API, migrations, uploads
frontend/    React + Tailwind SPA
docs/        Detailed technical documentation (linked below)
```
No monorepo workspace tooling — `backend/` and `frontend/` are independent pnpm projects with their own lockfiles. There is no shared code between them at this project's scale.

## Documentation

| Doc | Covers |
|---|---|
| [`docs/schema.md`](docs/schema.md) | Full database schema, ER diagram, and the reasoning behind key modeling decisions (merged users table, polymorphic assignment targeting, per-student submission tracking). |
| [`docs/architecture.md`](docs/architecture.md) | System diagram, folder structure, request lifecycle walkthrough, tech stack rationale. |
| [`docs/api.md`](docs/api.md) | Every endpoint — method, path, auth requirements, request/response shapes. |
| [`docs/frontend.md`](docs/frontend.md) | Route map, component inventory, state management, and the two-step submission modal interaction. |
| [`docs/security.md`](docs/security.md) | Auth strategy, rate limiting, validation, and explicitly stated known limitations. |
| [`docs/testing.md`](docs/testing.md) | Manual verification approach and full test checklist. |
| [`docs/postman.md`](docs/postman.md) | How to import and run the Postman collection in `postman/` — full happy-path walkthrough plus illustrative error cases. |
| [`docs/deployment.md`](docs/deployment.md) | Annotated Docker setup and Railway production deployment steps. |

## Key Design Decisions (summary — full detail in linked docs)
- **Single `users` table** with a `role` column, not separate student/educator tables — shared auth logic, one codebase.
- **Two-step submission confirmation** (`not_submitted → pending_confirmation → confirmed`) enforced server-side, matching the brief exactly.
- **Submissions tracked per-student even for group assignments** — required for progress bars to show partial group completion, not just a binary flag.
- **JWT access-token-only**, no refresh/revocation — a deliberate, stated scope tradeoff for an assessment timeline (see `docs/security.md`).
- **File uploads to local/volume disk**, not S3/R2 — avoids cloud storage setup overhead at this scale.
- **No group invite accept/decline flow in this version** — direct-add by group leader; deferred as a documented next step.

## Known Scope Boundaries
Educator identity verification, auto-archival of overdue assignments, and group invite consent are intentionally out of scope — none are required by the brief. Reasoning documented in `docs/security.md` and `docs/schema.md` rather than left unexplained.
