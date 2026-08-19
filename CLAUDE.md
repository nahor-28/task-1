# CLAUDE.md — Project Working Notes

Internal reference for this project's settled decisions. Purpose: don't relitigate closed questions mid-build.

## Working rule — confirm before acting
Before writing code or making any changes, always give a brief (what you plan to do and why) and ask for explicit confirmation. Only proceed after I say yes.

## Working rule — skills
For this project only: do not invoke any Claude Code skill other than `ponytail` unless I explicitly ask for it by name. Before committing, run the `ponytail` skill to check the diff for code redundancies/over-engineering.

## Stack
- Frontend: React.js + Tailwind CSS
- Backend: Node.js + Express + PostgreSQL
- Containerization: Docker + Docker Compose
- Package manager: pnpm (confirmed, not switching to npm)
- Deployment: Railway (single service — backend serves built frontend as static files)
- Transactional email: Brevo

## Repo structure
Two independent folders, no monorepo workspace tooling (no root package.json, no pnpm-workspace.yaml):
```
root/
├── docker-compose.yml
├── .env               (gitignored)
├── .env.example        (committed)
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── migrations/
│   ├── uploads/        (gitignored, mkdir'd on boot)
│   └── src/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── pnpm-lock.yaml
│   └── src/
└── docs/
    ├── schema.md
    ├── architecture.md
    ├── security.md
    ├── api.md
    ├── testing.md
    └── deployment.md
```
Reason: zero shared code between the two apps. Workspace tooling was considered and reversed — adds complexity with no payoff at this scale.

## Auth
- JWT, access-token-only, ~1hr expiry.
- No refresh token, no server-side revocation. Logout does not invalidate a live token before expiry. This is a stated, accepted tradeoff for assessment scope — documented in security.md, not hidden.
- Password hashing: bcrypt.
- Email verification: Brevo transactional email, token-based link, single `users` table with `email_verified` boolean.

## Database
- Single merged `users` table with `role` enum ('student' | 'educator'). Not two separate tables.
- 6 tables total: users, groups, group_members, assignments, assignment_targets, submissions.
- No standalone `reports` table — reports are SQL views/aggregate queries over `submissions`.
- `assignment_targets` is polymorphic (student OR group per row, enforced by CHECK constraint) — avoids UNION queries on read.
- `submissions` is always per-student, even for group-targeted assignments (fan-out on assignment creation, one row per group member). This is required for progress-bar math (numerator/denominator per student).
- `submissions.student_id` references `users` directly (not through `group_members`) — historical submission data survives if a student later leaves the group.
- Two-step submission confirmation: `not_submitted` → `pending_confirmation` (on "Yes, I have submitted") → `confirmed` (on second confirm click). Matches brief exactly — do not collapse to one step.

## Explicit scope cuts — do not add back without discussion
- Educator ID/document verification — not in brief, dropped.
- Auto-complete-on-due-date via cron — brief only asks for tracking, not auto-closure.
- Group invite accept/decline flow — deferred. MVP is direct-add by leader. If time permits post-MVP: add `status` column to `group_members` (pending/accepted/declined) and two new endpoints. Schema change is additive, not a rearchitecture.
- File storage via S3/R2 — using local disk (Docker volume in dev, Railway volume in prod) via multer instead, to avoid bucket/credential setup overhead.

## Locked design decisions (defaulted, confirmed by user)
- Group permissions: leader-only can remove members or delete the group.
- Assignment lifecycle: edit allowed anytime; delete blocked once any submission exists (must archive instead — archive mechanism TBD at implementation).
- Deployment topology: single Railway service, backend serves built frontend as static files.

## API conventions
- REST resources, not RPC-style action paths. E.g. `POST /assignments/:id/assign` with `{ targetType, targetId }` body — not separate `/assign/[studentId]` vs `/assign/[groupId]` routes.
- Reports via query params against views: `GET /reports?studentId=` or `?groupId=`.
- Rate limiting tiered, not flat: aggressive on `/auth/register` and `/auth/login`, loose on read endpoints.
- Full detail in `docs/api.md`.

## Build order (do not build out of sequence)
1. Migrations (raw SQL, no ORM migration abstraction) — test constraints directly against Postgres.
2. Auth end-to-end (register → verify → login → JWT → role middleware) for one role, then extend.
3. Educator: assignment CRUD + file upload (multer, local disk), no targeting yet.
4. Student: groups (create, add member, leader-only remove/delete).
5. Assignment targeting + submissions fan-out (transactional — test explicitly: assign to 3-member group, confirm exactly 3 submissions rows created).
6. Student: two-step submission (submit → confirm).
7. Dashboards (both roles) — read-only views over already-tested data.

## Testing approach
Manual verification only, not an automated suite — time-boxed assessment scope, prioritizing feature completeness. One critical manual test: the group-assign fan-out logic. Full checklist in `docs/testing.md`.
- When testing the API in the terminal, use `curl`.
- Postman guide is written only after all curl testing is complete and marked successful — don't draft it early.
- Every testing result (curl runs, manual checklist runs) gets logged in `docs/testing-log.md` in the repo — append as tests are run, don't just report results in chat.

## Git operations
Review my current changes (staged and unstaged) and organise them into clean commits.

1. Summarise what actually changed and why, grouped by intent.
2. Split the work into atomic commits – one logical change each.
   If something mixes a fix and a refactor, separate them.
3. For each commit write a Conventional Commits message:
   `type(scope): short imperative summary under 60 chars`
   Then a blank line and a body explaining WHY the change was needed and any tradeoffs.
   Mark breaking changes with `BREAKING CHANGE:`.
4. Order the commits so the repo builds and tests pass at every single step.
5. Output the exact git commands to run in sequence, including which files go in which commit.

Types: feat, fix, refactor, perf, docs, test, chore, style, build, ci
Never write vague messages like "update", "fix stuff", "changes" or "wip".
