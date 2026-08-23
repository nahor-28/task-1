# CLAUDE.md — Project Working Notes

Internal reference for this project's settled decisions. Purpose: don't relitigate closed questions mid-build.

## Working rule — confirm before acting
Before writing code or making any changes, always give a brief (what you plan to do and why) and ask for explicit confirmation. Only proceed after I say yes.

## Working rule — skills
For this project only: do not invoke any Claude Code skill other than `ponytail` unless I explicitly ask for it by name. Before committing, run the `ponytail` skill to check the diff for code redundancies/over-engineering.

## Working rule — pre-research before coding
Before writing code that uses an external library, package, or service (npm packages, Brevo, Multer, etc.), check the web first for the current stable version and up-to-date official documentation. Don't rely on training-data assumptions about versions or APIs — verify, then write code against what's actually current.

## Working rule — flag coding-standard defaults, don't silently pick one
Before defaulting on any coding-standard-level choice — module system (CommonJS vs ESM), code style/formatting conventions, file naming conventions, async patterns (callbacks vs promises vs async/await), import ordering, or similar low-level conventions not already settled elsewhere in this file — ask which one I want instead of silently picking one. This applies even when the choice seems minor or unlikely to affect the overall project outcome; these are coding standards I want to be informed about and decide on, not just functional/architectural choices (like Node vs pnpm vs Express version, which are already covered by the general confirm-before-acting rule). Once I answer, record the decision here so it doesn't get re-asked.

**Decided:**
- Module system: **ESM** (`import`/`export`, `"type": "module"` in `package.json`), not CommonJS.
- Frontend component file naming: **PascalCase.jsx** (matches component/export name).
- Frontend async pattern: **async/await** (consistent with backend controllers/services).
- Frontend tooling: Vite + React Router v7 + Tailwind v4 (`@tailwindcss/vite` plugin) + native `fetch` (no axios) + React Context for auth state (no Redux/Zustand).

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
- 7 tables total: users, courses, course_enrollments, groups, group_members, assignments, submissions. `assignment_targets` is dropped (see below).
- No standalone `reports` table — reports are SQL views/aggregate queries over `submissions`.
- Courses are the top-level container: professors create courses, students self-enroll via `course_enrollments`, assignments belong to a course (`assignments.course_id`).
- `assignment_targets` is **dropped**. It existed to answer "who is this assignment for," but that's now always derivable from data that exists anyway: `course_enrollments` for individual assignments, `groups`/`group_members` for group assignments. A separate targeting table would have been a second source of truth that could drift.
- Groups are now **assignment-scoped, not reusable** — `groups.assignment_id` is NOT NULL. A group only exists in the context of one group-type assignment. Publishing a group assignment randomly seeds `num_groups` leaders (one group each); other enrolled students self-assemble by browsing and joining an open group.
- `submissions` is always per-student, even for group assignments (fan-out at publish time for leaders, at join time for joining members). This is required for progress-bar math (numerator/denominator per student). `submissions.group_id` (nullable) links group-assignment rows to their group.
- `submissions.student_id` references `users` directly (not through `group_members`) — historical submission data survives if a student later leaves the group.
- Submission status is now a 4-state enum: `not_submitted` → `pending_confirmation` (on submit) → `waiting_for_grading` (individual self-confirm, or leader confirm-all sweep) → `graded` (professor marks graded, per row). This replaces the old 3-state (`not_submitted`/`pending_confirmation`/`confirmed`) enum — do not resurrect `confirmed` as a terminal state, grading is now the terminal state.
- Leader confirm-all is non-blocking: it warns on any group member still `not_submitted` but proceeds anyway, sweeping every member row (leader's own included) to `waiting_for_grading` in one transaction. This is a stated, accepted behavior, not a bug to fix later.

## Explicit scope cuts — do not add back without discussion
- Educator ID/document verification — not in brief, dropped.
- Auto-complete-on-due-date via cron — brief only asks for tracking, not auto-closure.
- Group invite accept/decline flow — superseded by self-assembly (student browses open groups and joins directly, no invite/approval step). The old "direct-add by leader" MVP note no longer applies now that groups are assignment-scoped and leader-seeded at publish time.
- File storage via S3/R2 — using local disk (Docker volume in dev, Railway volume in prod) via multer instead, to avoid bucket/credential setup overhead.

## Locked design decisions (defaulted, confirmed by user)
- Group permissions: groups are assignment-scoped and leader-seeded at publish time (random selection from course enrollment); leader has sole confirm-all authority for the group. No manual create/delete/remove-member flow — that no longer applies now that groups aren't standalone.
- Assignment lifecycle: draft-by-default, one-way publish (draft → published, no un-publish); edit allowed anytime; delete blocked once any submission exists (must archive instead — archive mechanism TBD at implementation).
- Deployment topology: single Railway service, backend serves built frontend as static files.

## API conventions
- REST resources, not RPC-style action paths. E.g. `POST /assignments/:id/publish` (no body) — targeting is implicit via enrollment/group membership, not a separate `/assign` action with a target payload (superseded — see Database section above).
- `GET /reports/dashboard` is role-branched (any authenticated user): educator gets courses taught + per-assignment status breakdown; student gets enrolled courses + assignment statuses. Per-student/per-group drill-down stays query-param based: `GET /reports?studentId=` or `?groupId=`.
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
