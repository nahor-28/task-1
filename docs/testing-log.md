# Testing Log

Append-only log of manual/curl test runs, per `CLAUDE.md`. Postman guide is written only after all curl testing here is marked successful.

---

## 2026-08-19 — Backend scaffold: health check

**Context:** Phase 0, Task 1 (scaffolding). Verifying the bare Express app boots and responds before wiring Docker Compose or migrations.

**Setup:** `backend/src/index.js`, ESM (`"type": "module"`), Express 4.22.2, run directly with `node` (not yet via Docker Compose). Local port 5000 is occupied by macOS AirPlay Receiver (ControlCenter), so ran on `PORT=5050` for this local-only check — not an app issue, won't occur inside Docker.

**Test:**
```bash
PORT=5050 node src/index.js
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:5050/api/v1/health
```

**Result:** PASS
```
{"status":"ok"}
HTTP_STATUS:200
```

**Notes:** Initial run used CommonJS (`require`); switched to ESM (`import`) per user decision before this logged run — re-verified after the switch to confirm behavior was unchanged.

---

## 2026-08-19 — Docker Compose stack: Postgres + backend boot

**Context:** Phase 0, Task 2. Wired `docker-compose.yml` (postgres + backend, healthcheck, volumes) and verified the full stack builds and boots together, per `docs/deployment.md`.

**Issues hit and fixed along the way:**
1. **pnpm supply-chain block**: pnpm refused to run `bcrypt`'s native build script (`ERR_PNPM_IGNORED_BUILDS`). Fixed by adding `"pnpm": { "onlyBuiltDependencies": ["bcrypt"] }` to `backend/package.json`.
2. **pnpm version skew**: Docker's Corepack pulled latest pnpm (11.22.0) while local Mac had 10.6.5 (and local Node 22.12.0 is below the 22.13 minimum pnpm 11 requires) — inconsistent behavior between environments. User chose to pin `"packageManager": "pnpm@10.6.5"` in `backend/package.json` (recommended option) rather than upgrade local Node/pnpm. Both environments now use the same pnpm version.
3. **Postgres 18 volume layout change**: `postgres:18-alpine` expects a single mount at `/var/lib/postgresql`, not `/var/lib/postgresql/data` (changed from prior major versions). Updated `docker-compose.yml` volume mount accordingly.
4. **Empty DB credentials**: local `.env` (copied from `.env.example`) had blank `DB_USER`/`DB_PASSWORD`/`DB_NAME`, so Postgres refused to initialize. Filled in local dev values in `.env` (gitignored — `.env.example` stays blank).
5. **Host port 5000 conflict**: macOS AirPlay Receiver (ControlCenter) occupies port 5000 on this Mac. Backend container still listens on 5000 internally (matches `docs/api.md`), but the host-side port mapping in `docker-compose.yml` is now overridable via `BACKEND_HOST_PORT` (defaults to 5000). This Mac uses `BACKEND_HOST_PORT=5050` locally.

**Test:**
```bash
docker compose up --build -d
curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:5050/api/v1/health
docker compose logs backend --tail 20
docker compose down
```

**Result:** PASS
```
{"status":"ok"}
HTTP_STATUS:200
```
Postgres container reported healthy before backend started (`depends_on: condition: service_healthy` working as intended). Backend logs confirmed nodemon watching and `Backend listening on port 5000` inside the container. Stack torn down cleanly afterward (`docker compose down`, volumes preserved).

---

## 2026-08-19 — Migration: `users` table

**Context:** Phase 1, Task 4. Wrote `backend/src/migrations/001_create_users.sql` per `docs/schema.md`'s `users` table spec, verified directly against Postgres before moving on (per `CLAUDE.md` build order step 1: "test constraints directly against Postgres").

**Setup:** `docker compose up -d postgres` only (backend not needed for this check), applied the migration via `psql -f`.

**Test 1 — table creation:**
```bash
docker compose exec -T postgres psql -U devuser -d assignment_tracker -f - < backend/src/migrations/001_create_users.sql
docker compose exec -T postgres psql -U devuser -d assignment_tracker -c "\d users"
```
**Result:** PASS — table created with all 7 columns, correct types/defaults (`gen_random_uuid()` for `id`, `false` for `email_verified`, `now()` for `created_at`), `PRIMARY KEY` on `id`, `UNIQUE` on `email`, `CHECK` constraint on `role`.

**Test 2 — valid insert:**
```sql
INSERT INTO users (name, email, password_hash, role) VALUES ('Test Student', 'student@test.com', 'hashed', 'student') RETURNING id, email, role, email_verified, created_at;
```
**Result:** PASS — row inserted, `id` auto-generated, `email_verified` defaulted to `f`, `created_at` set to current timestamp.

**Test 3 — CHECK constraint rejects invalid role:**
```sql
INSERT INTO users (name, email, password_hash, role) VALUES ('Bad', 'bad@test.com', 'x', 'admin');
```
**Result:** PASS — rejected: `violates check constraint "users_role_check"`.

**Test 4 — UNIQUE constraint rejects duplicate email:**
```sql
INSERT INTO users (name, email, password_hash, role) VALUES ('Dup', 'student@test.com', 'x', 'educator');
```
**Result:** PASS — rejected: `duplicate key value violates unique constraint "users_email_key"`.

**Notes:** `gen_random_uuid()` used directly (no `pgcrypto` extension needed — built into Postgres core since v13, confirmed working on `postgres:18-alpine`). Stack torn down (`docker compose down`) after verification.

---

## 2026-08-19 — Migrations: `groups`, `group_members` tables

**Context:** Phase 1, Task 5. Wrote `backend/src/migrations/002_create_groups.sql` and `003_create_group_members.sql` per `docs/schema.md`. Postgres volume from the prior session persisted, so `users` already existed; applied only the two new migrations on top.

**Test 1 — table creation:**
```bash
docker compose exec -T postgres psql -U devuser -d assignment_tracker -f - < backend/src/migrations/002_create_groups.sql
docker compose exec -T postgres psql -U devuser -d assignment_tracker -f - < backend/src/migrations/003_create_group_members.sql
```
**Result:** PASS — `\d groups` and `\d group_members` confirmed correct columns/types/defaults, composite `PRIMARY KEY (group_id, student_id)` on `group_members`, `role` `CHECK` constraint, and both `FOREIGN KEY ... ON DELETE CASCADE` constraints wired correctly.

**Test 2 — insert group + leader member:**
```sql
INSERT INTO groups (name, created_by) VALUES ('Test Group', <student_id>) RETURNING id;
INSERT INTO group_members (group_id, student_id, role) VALUES (<group_id>, <student_id>, 'leader');
```
**Result:** PASS — row inserted and joined correctly.

**Test 3 — cascade delete (manual checklist item, groups section):**
```sql
DELETE FROM groups WHERE name = 'Test Group';
SELECT count(*) FROM group_members;  -- expect 0
```
**Result:** PASS — `group_members` row cascade-deleted with the group (count went from 1 to 0), matching `docs/testing.md` checklist item.

**Test 4 — CHECK constraint rejects invalid `group_members.role`:**
```sql
INSERT INTO group_members (group_id, student_id, role) VALUES (<group_id>, <student_id>, 'owner');
```
**Result:** PASS — rejected with `check_violation`.

**Notes:** Stack torn down (`docker compose down`) after verification.

---

## 2026-08-19 — Migration: `assignments` table

**Context:** Phase 1, Task 6. Wrote `backend/src/migrations/004_create_assignments.sql` per `docs/schema.md`. `title`, `description`, `due_date`, `onedrive_link`, `created_by` set `NOT NULL` (all required at creation per `api.md`'s `POST /assignments` body); `attachment_url` left nullable since it's populated later via the separate `POST /assignments/:id/attachment` endpoint.

**Test 1 — table creation:**
```bash
docker compose exec -T postgres psql -U devuser -d assignment_tracker -f - < backend/src/migrations/004_create_assignments.sql
```
**Result:** PASS — `\d assignments` confirmed correct columns/types/nullability and `FOREIGN KEY (created_by) REFERENCES users(id)`.

**Test 2 — insert without attachment, then update attachment_url later:**
```sql
INSERT INTO assignments (title, description, due_date, onedrive_link, created_by)
SELECT 'Assignment 1', 'Do the thing', now() + interval '7 days', 'https://onedrive.example/abc', id
FROM users WHERE email = 'educator@test.com';
UPDATE assignments SET attachment_url = '/uploads/uuid-file.pdf' WHERE title = 'Assignment 1';
```
**Result:** PASS — insert succeeded with `attachment_url` NULL, later update set it correctly — matches the two-step create-then-upload flow in `docs/api.md`.

**Test 3 — FK constraint rejects nonexistent `created_by`:**
```sql
INSERT INTO assignments (title, description, due_date, onedrive_link, created_by) VALUES ('Bad', 'x', now(), 'https://x', gen_random_uuid());
```
**Result:** PASS — rejected: `violates foreign key constraint "assignments_created_by_fkey"`.

**Notes:** Stack torn down (`docker compose down`) after verification.

---

## 2026-08-19 — Migration: `assignment_targets` table (polymorphic)

**Context:** Phase 1, Task 7. Wrote `backend/src/migrations/005_create_assignment_targets.sql` per `docs/schema.md` — the polymorphic junction table with a CHECK constraint enforcing exactly one of `student_id`/`group_id` is set. These are the two critical constraint tests explicitly listed in `docs/testing.md`'s migration checklist.

**Test 1 — table creation:**
```bash
docker compose exec -T postgres psql -U devuser -d assignment_tracker -f - < backend/src/migrations/005_create_assignment_targets.sql
```
**Result:** PASS — `\d assignment_targets` confirmed the CHECK constraint and both FKs (`assignment_id ON DELETE CASCADE`, `student_id`/`group_id` without cascade).

**Test 2 — valid: student-only target:**
```sql
INSERT INTO assignment_targets (assignment_id, student_id) VALUES (<assignment_id>, <student_id>);
```
**Result:** PASS.

**Test 3 — valid: group-only target:**
```sql
INSERT INTO assignment_targets (assignment_id, group_id) VALUES (<assignment_id>, <group_id>);
```
**Result:** PASS.

**Test 4 — invalid: both `student_id` and `group_id` set (checklist item):**
```sql
INSERT INTO assignment_targets (assignment_id, student_id, group_id) VALUES (<assignment_id>, <student_id>, <group_id>);
```
**Result:** PASS — rejected: `violates check constraint "assignment_targets_check"`.

**Test 5 — invalid: neither set (checklist item):**
```sql
INSERT INTO assignment_targets (assignment_id) VALUES (<assignment_id>);
```
**Result:** PASS — rejected: `violates check constraint "assignment_targets_check"`.

**Notes:** Stack torn down (`docker compose down`) after verification. Both migration-checklist CHECK-constraint items for this table are now covered.

---

## 2026-08-19 — Migration: `submissions` table (last of 6 tables)

**Context:** Phase 1, Task 8. Wrote `backend/src/migrations/006_create_submissions.sql` per `docs/schema.md`. Covers the remaining migration-checklist items: duplicate `(assignment_id, student_id)` rejection and the group-delete/member-remove historical-preservation behavior.

**Test 1 — table creation:**
```bash
docker compose exec -T postgres psql -U devuser -d assignment_tracker -f - < backend/src/migrations/006_create_submissions.sql
```
**Result:** PASS — `\d submissions` confirmed `status` CHECK constraint (3 valid values, default `not_submitted`), `UNIQUE (assignment_id, student_id)`, and both FKs `ON DELETE CASCADE` to `assignments`/`users` directly (not through `group_members`).

**Test 2 — valid insert with defaults:**
```sql
INSERT INTO submissions (assignment_id, student_id) VALUES (<assignment_id>, <student_id>);
```
**Result:** PASS — `status` defaulted to `not_submitted`, `submitted_at`/`confirmed_at` NULL.

**Test 3 — duplicate `(assignment_id, student_id)` rejected (checklist item):**
```sql
INSERT INTO submissions (assignment_id, student_id) VALUES (<same assignment_id>, <same student_id>);
```
**Result:** PASS — rejected: `violates unique constraint "submissions_assignment_id_student_id_key"`.

**Test 4 — invalid status rejected:**
```sql
UPDATE submissions SET status = 'done' WHERE ...;
```
**Result:** PASS — rejected: `violates check constraint "submissions_status_check"`.

**Test 5 — historical preservation (checklist item — group delete with members):**
```sql
-- student has 1 existing submission row, then joins a group
DELETE FROM group_members WHERE group_id = ... AND student_id = ...;  -- leaves group
-- submissions count for student: still 1
DELETE FROM groups WHERE id = ...;  -- group_members cascades
-- submissions count for student: still 1
```
**Result:** PASS — submission row survived both the member removal and the full group deletion, confirming `submissions.student_id` references `users` directly and does not cascade through `group_members`, per the schema rationale.

**Notes:** Stack torn down (`docker compose down`) after verification. All 6 tables now exist with all constraints from `docs/testing.md`'s migration checklist verified.

---

## 2026-08-19 — Migration runner script

**Context:** Phase 1, Task 9. Wrote `backend/src/db/migrate.js` (raw SQL runner, no ORM, per `CLAUDE.md`) — tracks applied migrations in a `schema_migrations` table, applies pending `.sql` files from `src/migrations/` in filename order, each wrapped in its own transaction. Wired to `pnpm run migrate` (already referenced in `package.json`).

**Test 1 — full run against a clean database (checklist item: "run migrations against a clean Postgres instance, confirm all 6 tables created"):**
```bash
docker compose down -v   # wipe volume
docker compose up -d postgres
DATABASE_URL="postgres://devuser:devpassword@localhost:5432/assignment_tracker" node src/db/migrate.js
```
**Result:** PASS
```
Applied: 001_create_users.sql
Applied: 002_create_groups.sql
Applied: 003_create_group_members.sql
Applied: 004_create_assignments.sql
Applied: 005_create_assignment_targets.sql
Applied: 006_create_submissions.sql
Migrations up to date.
```
`\dt` confirmed all 6 tables plus `schema_migrations` present.

**Test 2 — idempotency (re-run with nothing pending):**
```bash
node src/db/migrate.js
```
**Result:** PASS — output was just `Migrations up to date.`, no re-applies.

**Test 3 — failure handling (bad SQL, temporary test file):**
```bash
echo "SELECT this is not valid sql;" > src/migrations/999_bad_test.sql
node src/db/migrate.js   # then delete the test file
```
**Result:** PASS — script printed `Failed: 999_bad_test.sql`, exited non-zero (exit code 1) instead of failing silently, and `SELECT name FROM schema_migrations` afterward showed only the original 6 real migrations — the bad one was rolled back and never recorded as applied.

**Notes:** Stack torn down (`docker compose down`) after verification. Migration workflow (write `.sql` file → `pnpm run migrate`) is now fully functional for Phase 2 onward.

---

## 2026-08-19 — `POST /auth/register` (student role, first pass)

**Context:** Phase 2, Task 11. First auth endpoint — student role only for now (educator added in Task 16). New pieces: `backend/src/db/pool.js` (shared `pg.Pool`), `backend/src/middleware/validate.js` (generic zod body validator), `backend/src/services/authService.js` (bcrypt hash + insert), `backend/src/controllers/authController.js`, `backend/src/routes/auth.js`. Fixed an Express-4-specific bug along the way: async route handlers don't auto-forward thrown errors to error middleware in Express 4 (unlike Express 5) — controller now calls `next(err)` explicitly for unexpected errors, with a global error handler added in `src/index.js`.

**Setup:** Full stack via `docker compose up -d --build` with a fresh volume, migrations run via `docker compose exec backend pnpm run migrate` (confirms the migration workflow works inside the container, not just locally).

**Test 1 — valid registration:**
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:5050/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Student","email":"alice@test.com","password":"password123","role":"student"}'
```
**Result:** PASS — `201 {"userId": "..."}`.

**Test 2 — duplicate email:**
**Result:** PASS — `409 {"error":{"message":"Email already registered","code":"EMAIL_IN_USE"}}`.

**Test 3 — invalid email format:**
**Result:** PASS — `400`, `VALIDATION_ERROR`.

**Test 4 — password under 8 chars:**
**Result:** PASS — `400`, `VALIDATION_ERROR`.

**Test 5 — disallowed role (`educator`, not yet supported in this pass):**
**Result:** PASS — `400`, `VALIDATION_ERROR`.

**Test 6 — missing required fields:**
**Result:** PASS — `400`, `VALIDATION_ERROR`.

**Test 7 — password never stored in plaintext, `email_verified` defaults false:**
```sql
SELECT name, email, role, email_verified, password_hash FROM users WHERE email = 'alice@test.com';
```
**Result:** PASS — `password_hash` is a bcrypt hash (`$2b$10$...`, cost factor 10 per `docs/security.md`), `email_verified` is `f`.

**Test 8 — server didn't crash after error-path requests (validates the Express 4 `next(err)` fix):**
```bash
docker compose ps   # backend still "Up", not restarted/crashed
curl .../api/v1/health   # still 200
```
**Result:** PASS.

**Notes:** Stack torn down (`docker compose down`) after verification. Registration is currently student-only by design (Task 11 scope); educator role and login/JWT come next.

---

## 2026-08-19 — Brevo email verification + `GET /auth/verify`

**Context:** Phase 2, Task 12. Verification token is a stateless signed JWT (`{ userId, purpose: 'email_verification' }`, 24h expiry, signed with `JWT_SECRET`) — user's choice over a DB-stored token column, since resend functionality isn't built yet and a stateless token needs no schema change while still being "signed, time-limited" per `docs/security.md`. New pieces: `backend/src/services/emailService.js` (`@getbrevo/brevo` v6.0.3, current stable), `authService.js` extended with `verifyEmail()`, controller/route additions for `GET /auth/verify`. `registerUser` catches email-send failures and logs them rather than failing the whole registration (email delivery being down shouldn't block account creation).

**Test 1 — register triggers a real Brevo send attempt:**
```bash
curl -X POST http://localhost:5050/api/v1/auth/register -d '{"name":"Bob Student","email":"...","password":"password123","role":"student"}'
```
**Result:** PARTIAL — registration succeeded (`201`, matches Test 1 design goal: email failure must not block registration), but the actual Brevo send failed with `401 unauthorized` — Brevo's IP-allowlist security check rejected the request from this machine's IP. This is a Brevo account configuration issue (IP not yet authorized at https://app.brevo.com/security/authorised_ips), not an application bug. User is authorizing the IP on their end; **real email delivery still needs re-testing once that's done.**

**Test 2 — verify with a token generated the same way the app generates it (simulating the link a user would click, since the real email didn't arrive):**
```bash
# token signed via: jwt.sign({ userId, purpose: 'email_verification' }, JWT_SECRET, { expiresIn: '24h' })
curl "http://localhost:5050/api/v1/auth/verify?token=<token>"
```
**Result:** PASS — `200 {"verified":true}`. Confirmed in DB: `email_verified` changed from `f` to `t` for that user.

**Test 3 — invalid/garbage token:**
**Result:** PASS — `400 INVALID_TOKEN`.

**Test 4 — missing token:**
**Result:** PASS — `400 INVALID_TOKEN`.

**Test 5 — wrong-purpose token (a validly-signed JWT with `purpose: 'access'` instead of `'email_verification'`):**
**Result:** PASS — `400 INVALID_TOKEN` — confirms the `purpose` claim check prevents a future access token from being reused to verify an email.

**Notes:** Stack torn down (`docker compose down`) after verification.

---

## 2026-08-19 — Follow-up: real Brevo delivery, end-to-end

**Context:** Closes out the follow-up from the prior entry. User authorized this machine's IP in Brevo's dashboard (https://app.brevo.com/security/authorised_ips) after the earlier `401 unauthorized` block.

**Test — register, receive real email, click real link:**
```bash
curl -X POST http://localhost:5050/api/v1/auth/register -d '{"name":"Real Send Test","email":"...+brevotest@gmail.com",...}'
# backend logs: no "Failed to send" error this time
# user confirmed the email physically arrived in their inbox
curl "http://localhost:5050/api/v1/auth/verify?token=<real token copied from the received email>"
```
**Result:** PASS — email delivered for real via Brevo, and the real token from that email correctly verified: `200 {"verified":true}`, DB `email_verified` confirmed `t`. Full register → email → verify flow now proven end-to-end with no synthetic shortcuts.

**Notes:** Stack torn down (`docker compose down`) after verification. Task 12 fully closed, no open follow-ups.

---

## 2026-08-19 — `POST /auth/login` + JWT issuance, plus strict-tier rate limiting

**Context:** Phase 2, Task 13. Added `loginUser()` to `authService.js`, `login` controller, and `backend/src/middleware/rateLimit.js` (strict tier, 5/min/IP per `docs/security.md`) applied to both `/register` and `/login`. JWT payload is `{ userId, role }`, 1h expiry, per `docs/security.md`.

**Bug caught during testing:** initial `rateLimit.js` exported one shared limiter *instance* reused on both routes, so register and login traffic counted against the same IP bucket — a login lockout would also block registration and vice versa. `docs/security.md`'s tier table lists both endpoints under "Strict" as separate rows, which reads as 5/min **per endpoint**, not a combined budget. Fixed by making `strictLimiter` a factory function, called once per route, giving each its own independent limiter state.

**Test 1 — valid login (verified user):**
```bash
curl -X POST http://localhost:5050/api/v1/auth/login -d '{"email":"...","password":"password123"}'
```
**Result:** PASS — `200 {"token": "...", "user": {"id","name","role"}}`, matches `docs/api.md` response shape.

**Test 2 — wrong password:**
**Result:** PASS — `401 {"error":{"message":"Invalid email or password","code":"INVALID_CREDENTIALS"}}`.

**Test 3 — nonexistent email (checklist item: "confirm no user detail leaked in error message"):**
**Result:** PASS — identical `401 INVALID_CREDENTIALS` response as Test 2, no distinction between "wrong password" and "no such user".

**Test 4 — login attempt before email verification:**
```bash
# register a fresh user, don't verify, then:
curl -X POST http://localhost:5050/api/v1/auth/login -d '{"email":"unverified@test.com","password":"password123"}'
```
**Result:** PASS — `403 {"error":{"message":"Please verify your email before logging in","code":"EMAIL_NOT_VERIFIED"}}`.

**Test 5 — rate limit, 6+ requests in a minute (checklist item):**
```bash
for i in 1 2 3 4 5 6 7; do curl -X POST http://localhost:5050/api/v1/auth/login -d '...wrong password...'; done
```
**Result:** PASS (after the shared-instance bug was fixed and retested with fresh state) — requests 1-5 returned `401`, requests 6-7 returned `429`. `RateLimit`/`RateLimit-Policy`/`Retry-After` headers present and correct (`5-in-1min`).

**Test 6 — register unaffected by login's exhausted rate limit (confirms the fix):**
**Result:** PASS — `POST /register` returned `201` immediately after login's limiter was fully exhausted, confirming independent per-route buckets.

**Notes:** Stack torn down (`docker compose down`) after verification. Server remained healthy (`docker compose ps`) throughout, including through the 429 flood.

---

## 2026-08-19 — Auth middleware (`requireAuth`, `requireRole`) + `GET /users/me`

**Context:** Phase 2, Task 14. Added `backend/src/middleware/auth.js` (`requireAuth` verifies JWT from `Authorization: Bearer <token>`, attaches `req.user = { id, role }`; `requireRole(...roles)` factory for route-level role checks). `GET /users/me` added alongside it (documented in `docs/api.md`) as the minimal protected route needed to actually exercise the middleware — untested middleware isn't verified. `requireAuth` also rejects any token carrying a `purpose` claim, so an email-verification token can't be replayed as an access token (mirrors the reverse check already in `verifyEmail`).

**Test 1 — valid token:**
```bash
TOKEN=$(login response .token)
curl http://localhost:5050/api/v1/users/me -H "Authorization: Bearer $TOKEN"
```
**Result:** PASS — `200 { id, name, email, role }`.

**Test 2 — no token (checklist item):**
**Result:** PASS — `401 UNAUTHENTICATED`.

**Test 3 — malformed header (no `Bearer` prefix):**
**Result:** PASS — `401 UNAUTHENTICATED`.

**Test 4 — garbage/invalid token:**
**Result:** PASS — `401 UNAUTHENTICATED`.

**Test 5 — expired token (checklist item):**
```bash
# signed with expiresIn: -10 (already expired)
```
**Result:** PASS — `401 UNAUTHENTICATED`.

**Test 6 — verification token replayed as an access token:**
```bash
# a validly-signed { userId, purpose: 'email_verification' } JWT
```
**Result:** PASS — `401 UNAUTHENTICATED` — confirms the `purpose` claim check blocks cross-use of token types in both directions (Task 12 already confirmed the reverse: an access-shaped token can't be used to verify email).

**Notes:** Stack torn down (`docker compose down`) after verification. `requireRole` is written but not yet exercised by a real route — no role-restricted endpoint exists until educator-only assignment routes and student-only group routes are built in later phases. Will be covered implicitly then; flagging here rather than leaving it silently untested.

---

## 2026-08-19 — `POST /auth/logout`

**Context:** Phase 2, Task 15. Client-side token discard only — no server-side revocation store, a stated and accepted tradeoff per `docs/security.md`. Requires `Bearer` auth (per `docs/api.md`) but the handler does nothing beyond confirming the request is authenticated; it does not and cannot invalidate the token itself.

**Test 1 — logout with valid token:**
**Result:** PASS — `200 {}`.

**Test 2 — logout without a token:**
**Result:** PASS — `401 UNAUTHENTICATED` (via `requireAuth`).

**Test 3 — same token still works after logout (confirms the documented tradeoff, not a bug):**
```bash
curl http://localhost:5050/api/v1/users/me -H "Authorization: Bearer $SAME_TOKEN"  # after logout
```
**Result:** PASS — still `200`, token remains valid until its natural 1h expiry. Matches `docs/security.md`'s explicit statement: "a stolen token remains valid for up to 1 hour after logout."

**Notes:** Stack torn down (`docker compose down`) after verification. **Phase 2 (Auth end-to-end) is now functionally complete for the student role**: register → verify → login → protected route → logout, all tested. Educator role extension is Task 16.

---

## 2026-08-19 — Extend register/login to educator role

**Context:** Phase 2, Task 16. Only the route-level zod schema (`backend/src/routes/auth.js`) restricted registration to `student` — `authService.js`, the DB CHECK constraint, and `loginUser()` were already role-agnostic. One-line change: `z.enum(['student'])` → `z.enum(['student', 'educator'])`.

**Test 1 — register as educator:**
**Result:** PASS — `201 {"userId": "..."}`.

**Test 2 — invalid role still rejected (e.g. `admin`):**
**Result:** PASS — `400 VALIDATION_ERROR`, confirms the enum still gates out anything beyond the two real roles.

**Test 3 — verify + login as educator, full flow:**
**Result:** PASS — verify `200 {"verified":true}`; login `200` with `user.role: "educator"` and the JWT payload's `role` claim correctly set to `"educator"`.

**Test 4 — `requireRole` actually discriminates between roles (direct unit-style check, since no real educator-only route exists yet):**
```js
const middleware = requireRole('educator');
middleware({ user: { role: 'student' } }, res, next);   // expect rejected
middleware({ user: { role: 'educator' } }, res, next);  // expect passed through
```
**Result:** PASS — student request rejected with `403 FORBIDDEN`, educator request called `next()`. Confirms `requireRole`'s actual behavior rather than leaving it as an untested assumption, even before a live route consumes it.

**Notes:** Stack torn down (`docker compose down`) after verification. **Phase 2 (Auth end-to-end) is now fully complete for both roles.**

---

## 2026-08-19 — Task 17: consolidated end-to-end auth flow pass (both roles)

**Context:** User requested one consolidated regression pass in addition to the incremental per-task tests, running the entire chain back-to-back for both roles against a fresh stack: register → login-before-verify (expect rejection) → verify → login → protected route → logout.

**Test — full chain, student role (`e2e-student@test.com`):**
1. Register → `201`
2. Login before verify → `403 EMAIL_NOT_VERIFIED`
3. Verify → `200 {"verified":true}`
4. Login → `200`, token + `user.role: "student"`
5. `GET /users/me` with token → `200`, correct id/name/email/role
6. Logout → `200 {}`

**Result:** PASS — every step correct, no interference from prior test data in the (persisted) DB volume.

**Test — full chain, educator role (`e2e-educator@test.com`), same sequence:**

**Result:** PASS — identical to the student flow, with `role: "educator"` correctly threaded through login response, JWT payload, and `/users/me`.

**Notes:** Both flows run against the same backend instance in one script with no server restart between them, confirming no cross-role state leakage (e.g., rate limiter, JWT secret, DB pool all behaved correctly under back-to-back different-role traffic). Backend confirmed still healthy (`docker compose ps`) after the full run. Stack torn down afterward. **Phase 2 (Auth end-to-end) is fully complete and regression-tested for both roles.**

---

## 2026-08-19 — `POST /assignments` (create, educator only)

**Context:** Phase 3, Task 1 (Educator assignment CRUD begins). No targeting yet — assignments are created but not yet assigned to students/groups (that's Phase 5). `dueDate` validated with `z.coerce.date()` (lenient ISO parsing, converts straight to a JS `Date` that `pg` accepts natively for `timestamptz`), `onedriveLink` validated with `z.url()`.

**Test 1 — valid create as educator:**
**Result:** PASS — `201 {"assignmentId": "..."}`. Confirmed in DB: `created_by` matches the educator's user id, `due_date` correctly parsed, `attachment_url` NULL (pending Task 5).

**Test 2 — student attempts to create (role check):**
**Result:** PASS — `403 FORBIDDEN` via `requireRole('educator')` — first real route to exercise this middleware.

**Test 3 — unauthenticated:**
**Result:** PASS — `401 UNAUTHENTICATED`.

**Test 4 — missing required fields:**
**Result:** PASS — `400 VALIDATION_ERROR`.

**Test 5 — invalid `onedriveLink` (not a URL):**
**Result:** PASS — `400 VALIDATION_ERROR`.

**Notes:** Stack torn down (`docker compose down`) after verification. First endpoint to combine `requireAuth` + `requireRole` together, both confirmed working in combination (not just individually as in earlier tests).

---

## 2026-08-19 — `GET /assignments` (list) + `GET /assignments/:id` (detail)

**Context:** Phase 3, Task 2. `GET /assignments/:id` is open to any authenticated user (no ownership check) since students will eventually need to view assignments targeted at them, not just their own — matches `docs/api.md`'s wording (no "owner" qualifier, unlike PUT/DELETE). `GET /assignments` (list) returns an empty array for students for now, since targeting doesn't exist until Phase 5 — there's no way yet to know which assignments are relevant to a given student. Added a reusable `validateParams()` middleware (mirrors `validate()` but for `req.params`) since a malformed non-UUID `:id` would otherwise hit Postgres's UUID parser and throw a raw 500 — this problem recurs on every `:id` route across every resource, so fixing it generically now rather than per-route.

**Test 1 — list as educator (own assignments):**
**Result:** PASS — `200`, returned both assignments created by that educator (including the one from Task 1's test), ordered newest first.

**Test 2 — detail of a specific assignment:**
**Result:** PASS — `200`, full row returned.

**Test 3 — list as student (empty array, targeting not built yet):**
**Result:** PASS — `200 []`.

**Test 4 — student views assignment detail they don't own (no ownership block on GET):**
**Result:** PASS — `200`, full detail returned — confirms viewing is intentionally open, unlike edit/delete which will be ownership-gated in Tasks 3-4.

**Test 5 — non-UUID `:id` (e.g. `not-a-uuid`):**
**Result:** PASS — `400 VALIDATION_ERROR`, not a raw 500 from Postgres's UUID parser.

**Test 6 — valid UUID format but nonexistent assignment:**
**Result:** PASS — `404 NOT_FOUND`.

**Notes:** Stack torn down (`docker compose down`) after verification.

---

## 2026-08-19 — `PUT /assignments/:id` (edit, ownership-gated)

**Context:** Phase 3, Task 3. Partial update (`createSchema.partial()` via zod) — only provided fields are updated, everything else preserved. Ownership check: `updateAssignment()` fetches the existing row first, checks `created_by === requesterId`, and only then builds a dynamic `SET` clause from whichever fields were supplied. Edit allowed anytime (no due-date or submission-count restriction), per `CLAUDE.md`'s locked design decision.

**Test 1 — partial update (title only):**
**Result:** PASS — `200`, title updated, `description`/`onedrive_link`/`due_date` unchanged.

**Test 2 — non-owner educator attempts edit (checklist item: "Attempt edit/delete as a different educator — confirm 403"):**
```bash
# registered + verified a second educator account, attempted edit on the first educator's assignment
```
**Result:** PASS — `403 FORBIDDEN`.

**Test 3 — student attempts edit (role check via `requireRole`):**
**Result:** PASS — `403 FORBIDDEN`.

**Test 4 — edit nonexistent assignment:**
**Result:** PASS — `404 NOT_FOUND`.

**Test 5 — unauthenticated edit:**
**Result:** PASS — `401 UNAUTHENTICATED`.

**Test 6 — empty body (`{}`, no-op):**
**Result:** PASS — `200`, returned the row unchanged, no crash on a zero-column `SET` clause (handled explicitly: zero updatable keys short-circuits to returning the existing row without querying `UPDATE`).

**Notes:** Stack torn down (`docker compose down`) after verification. Second educator account (`other-edu@test.com`) created for this test remains in the DB for reuse in Task 4's delete-ownership test.

---

## 2026-08-19 — `DELETE /assignments/:id` (ownership-gated, submission-blocked)

**Context:** Phase 3, Task 4 — completes `docs/testing.md`'s "Assignments (Educator)" checklist section. `deleteAssignment()` checks existence → ownership → submission count (`SELECT 1 FROM submissions WHERE assignment_id = $1 LIMIT 1`) → only then deletes. Since assignment targeting/submission fan-out isn't built until Phase 5, the has-submissions case was tested by manually inserting a `submissions` row via `psql` — simulating what the real fan-out will produce.

**Test 1 — delete with zero submissions (checklist item):**
**Result:** PASS — `200 {}`; confirmed gone via a follow-up `GET` returning `404`.

**Test 2 — delete blocked when a submission exists (checklist item):**
```sql
INSERT INTO submissions (assignment_id, student_id) VALUES ('<assignment_id>', '<student_id>');
```
```bash
curl -X DELETE .../assignments/<assignment_id>
```
**Result:** PASS — `409 {"error":{"message":"Cannot delete an assignment with existing submissions - archive instead","code":"HAS_SUBMISSIONS"}}`; confirmed the assignment still exists via a follow-up `GET` returning `200`.

**Test 3 — non-owner educator attempts delete (checklist item):**
**Result:** PASS — `403 FORBIDDEN`.

**Test 4 — student attempts delete:**
**Result:** PASS — `403 FORBIDDEN` via `requireRole`.

**Test 5 — unauthenticated delete:**
**Result:** PASS — `401 UNAUTHENTICATED`.

**Test 6 — delete nonexistent assignment:**
**Result:** PASS — `404 NOT_FOUND`.

**Notes:** Stack torn down (`docker compose down`) after verification. **`docs/testing.md`'s full "Assignments (Educator)" checklist section is now covered.** Only remaining piece of Phase 3 is Task 5 (multer file upload).

---

## 2026-08-19 — `POST /assignments/:id/attachment` (multer upload)

**Context:** Phase 3, Task 5 — completes Phase 3. Pre-research confirmed multer 2.2.0 is current stable and unaffected by CVE-2025-47944/CVE-2026-3520 (fixed at 2.1.1, we're newer). `diskStorage` writes to `backend/uploads/` (resolved via `import.meta.url`, matching the Docker volume mount), filename is `randomUUID() + original extension` — original filename never trusted directly, per `docs/security.md`. MIME whitelist (PDF, DOCX) and 10MB cap enforced via multer's `fileFilter`/`limits`. Multer's callback-style errors are wrapped in a small `handleUpload` route function that converts known errors (`LIMIT_FILE_SIZE`, the custom `INVALID_FILE_TYPE`) into clean `400` responses matching the API's error shape, passing anything unexpected to the global handler. Ownership check happens in the controller after multer runs (simplest option, consistent with every other assignment endpoint's pattern) - if unauthorized, the just-written file is deleted via `fs.unlink` so nothing is orphaned on disk.

**Test 1 — valid PDF upload:**
**Result:** PASS — `200 {"attachmentUrl": "/uploads/<uuid>.pdf"}`. Confirmed: file exists on disk with the UUID name (not the original `test.pdf`), `attachment_url` persisted in the DB.

**Test 2 — disallowed MIME type (`.txt`, checklist item):**
**Result:** PASS — `400 INVALID_FILE_TYPE`.

**Test 3 — file over the 10MB cap (checklist item):**
**Result:** PASS — `400 FILE_TOO_LARGE`. Confirmed no orphaned partial file left in `uploads/` — multer's `limits.fileSize` cleans up automatically.

**Test 4 — no file attached:**
**Result:** PASS — `400 VALIDATION_ERROR`.

**Test 5 — non-owner educator uploads a valid file (ownership + cleanup):**
**Result:** PASS — `403 FORBIDDEN`; confirmed the uploaded file was deleted (not left in `uploads/`) and the assignment's `attachment_url` was untouched by the rejected attempt.

**Test 6 — student attempts upload:**
**Result:** PASS — `403 FORBIDDEN` via `requireRole`, blocked before the file ever reaches multer.

**Notes:** Stack torn down (`docker compose down`) after verification. **Phase 3 (Educator assignment CRUD + file upload) is now fully complete and tested.** Next up per the build order: Phase 4 (student groups).

---

## 2026-08-19 — Phase 4: Groups (create, detail, add/remove member, delete, mine)

**Context:** Phase 4 — `POST /groups`, `GET /groups/:id`, `GET /groups/mine`, `POST /groups/:id/members`, `DELETE /groups/:id/members/:studentId`, `DELETE /groups/:id`, per `docs/api.md`'s Groups section and `docs/schema.md`'s `groups`/`group_members` tables (already migrated in Phase 0). `createGroup()` inserts the group and the creator's `leader` membership row in one transaction. Leader checks (`requireLeader`) and detail-view access (member-or-educator, per api.md) are enforced at the service layer, matching the ownership-gating pattern already used for assignments. Existing seed accounts reused: `rmrohan.1112@gmail.com` / `e2e-student@test.com` (students), `erica@test.com` (educator).

**Test 1 — create group (student), becomes leader:**
**Result:** PASS — `201 {"groupId": "..."}`. Follow-up `GET /groups/:id` shows one member with `role: "leader"`.

**Test 2 — detail as the leader (member access):**
**Result:** PASS — `200`, full member list returned.

**Test 3 — detail as a non-member student:**
**Result:** PASS — `403 FORBIDDEN`.

**Test 4 — detail as an educator not on the group (checklist item — "member of group or educator"):**
**Result:** PASS — `200`, educators can view any group's detail regardless of membership.

**Test 5 — add member (leader adds a second student):**
**Result:** PASS — `201 {"memberId": "..."}`.

**Test 6 — add the same member again (duplicate):**
**Result:** PASS — `409 ALREADY_MEMBER`.

**Test 7 — add member as a non-leader (member, not leader, tries):**
**Result:** PASS — `403 FORBIDDEN`.

**Test 8 — add a non-student (educator) `studentId`:**
**Result:** PASS — `404 STUDENT_NOT_FOUND` — target validated against `users.role = 'student'`, not just existence.

**Test 9 — `GET /groups/mine` for a member (not leader):**
**Result:** PASS — `200 [{ id, name }]` includes the group they were added to.

**Test 10 — remove member as a non-leader:**
**Result:** PASS — `403 FORBIDDEN`.

**Test 11 — remove member as leader:**
**Result:** PASS — `200 {}`.

**Test 12 — remove the same (now-removed) member again:**
**Result:** PASS — `404 NOT_MEMBER`.

**Test 13 — delete group as a non-member:**
**Result:** PASS — `403 FORBIDDEN`.

**Test 14 — delete group as leader:**
**Result:** PASS — `200 {}`. Follow-up `GET /groups/:id` returns `404 NOT_FOUND`.

**Notes:** Stack torn down (`docker compose down`) after verification. Hit the `/auth/login` strict rate limiter (5/min) mid-run re-authenticating multiple test accounts back-to-back — confirms the tiered rate limiting from Phase 2 is still working as intended, not a bug; just had to wait out the window between test batches. **Phase 4 (student groups) is now fully tested.** Next up per the build order: Phase 5 (assignment targeting + submissions fan-out).

---

## 2026-08-19 — Phase 5: `POST /assignments/:id/assign` (targeting + submissions fan-out)

**Context:** Phase 5 — the build order's flagged critical test: assign to a 3-member group, confirm exactly 3 `submissions` rows are created, transactionally. `assignTarget()` in `assignmentService.js` runs the `assignment_targets` insert and the `submissions` insert(s) inside a single `BEGIN`/`COMMIT` transaction on one client connection (mirroring the pattern already used for `createGroup`'s group+leader-membership insert). Duplicate-target unique-violations (`submissions(assignment_id, student_id)`) are caught in the controller by Postgres error code `23505`, following the exact pattern `authController.js` already uses for duplicate email registration — returns `409 ALREADY_ASSIGNED` instead of a raw `500`. Also closed out the "Students see nothing" placeholder in `listAssignments()` from Phase 3 — now joins `assignment_targets` (direct student target OR via `group_members` for a group target) in one query, no `UNION`, matching `schema.md`'s stated design rationale for the polymorphic `assignment_targets` table. Test student accounts: `rmrohan.1112@gmail.com`, `e2e-student@test.com`, and a newly registered `group-test-3@test.com` (verified directly via `psql` to build a 3-member group without waiting on Brevo).

**Test 1 — assign to a 3-member group (the critical test):**
```sql
SELECT count(*) FROM submissions WHERE assignment_id = '<id>';
```
**Result:** PASS — `201 {"targetId": "..."}`; exactly 3 `submissions` rows created (one per group member), all `not_submitted`.

**Test 2 — assign the same group again (duplicate, tests transaction rollback):**
**Result:** PASS — `409 ALREADY_ASSIGNED`. Confirmed no partial state: `submissions` count stayed at 3 (not 4+), `assignment_targets` count for this assignment stayed at 1 (the failed second insert rolled back along with the fan-out attempt) — the whole operation is atomic, not just the submissions loop.

**Test 3 — assign to a nonexistent group:**
**Result:** PASS — `404 GROUP_NOT_FOUND`.

**Test 4 — assign to an individual student (checklist item):**
**Result:** PASS — `201`; exactly 1 `submissions` row created for that student.

**Test 5 — assign to a non-student `targetId` (educator id) with `targetType: student`:**
**Result:** PASS — `404 STUDENT_NOT_FOUND`.

**Test 6 — non-owner educator attempts assign:**
**Result:** PASS — `403 FORBIDDEN`.

**Test 7 — student attempts assign:**
**Result:** PASS — `403 FORBIDDEN` via `requireRole`.

**Test 8 — unauthenticated assign:**
**Result:** PASS — `401 UNAUTHENTICATED`.

**Test 9 — invalid `targetType` (not `student`/`group`):**
**Result:** PASS — `400 VALIDATION_ERROR`, rejected by the Zod schema before touching the service.

**Test 10 — assign against a nonexistent assignment:**
**Result:** PASS — `404 NOT_FOUND`.

**Test 11 — `GET /assignments` as a student now returns targeted assignments (checklist item, was a Phase 3 placeholder):**
**Result:** PASS — a group member sees the assignment their group was targeted with; educator's own-assignments list is unaffected.

**Notes:** Stack torn down (`docker compose down`) after verification. Ran into the `/auth/login` strict rate limiter twice more mid-run (same as Phase 4 — expected, tiered rate limiting doing its job) and waited out the 60s window each time rather than working around it. **Phase 5 (assignment targeting + submissions fan-out) is now fully tested.** Next up per the build order: Phase 6 (student two-step submission).

---

## 2026-08-19 — Phase 6: `GET /submissions`, `GET /submissions/mine`, two-step submit/confirm

**Context:** Phase 6 — the last piece of core CRUD before dashboards. `submissionService.js` follows the same ownership-check pattern as assignments/groups: `getOwnedSubmission()` checks the row exists and `student_id` matches the requester before either state-transition endpoint runs. State transitions are guarded by current status per `docs/api.md` (`submit` requires `not_submitted`, `confirm` requires `pending_confirmation`) — matches the two-step design in `CLAUDE.md` (not collapsed to one step). Added `validateQuery` to `middleware/validate.js` (one-line addition to the existing `makeValidator` factory — `GET /submissions` and `/submissions/mine` are the first query-param routes in the app) since `assignmentId` is a query param, not a path param, per the API's query-param convention for non-CRUD reads. Reused the 3-member fan-out assignment (`34d96894-...`) from the Phase 5 test run.

**Test 1 — `GET /submissions/mine` before any submission action (checklist item):**
**Result:** PASS — `200 {"status":"not_submitted","submitted_at":null,"confirmed_at":null}`.

**Test 2 — non-owner student attempts `submit` on someone else's submission:**
**Result:** PASS — `403 FORBIDDEN`.

**Test 3 — `confirm` attempted before `submit` (skip step 1, checklist item):**
**Result:** PASS — `409 INVALID_STATE`.

**Test 4 — step 1, `submit` (checklist item — "Yes, I have submitted"):**
**Result:** PASS — `200 {"status":"pending_confirmation"}`; `submitted_at` set.

**Test 5 — `submit` again while already `pending_confirmation` (checklist item):**
**Result:** PASS — `409 INVALID_STATE`.

**Test 6 — step 2, `confirm` (checklist item):**
**Result:** PASS — `200 {"status":"confirmed"}`; `confirmed_at` set, `submitted_at` unchanged from step 1.

**Test 7 — `confirm` again while already `confirmed`:**
**Result:** PASS — `409 INVALID_STATE`.

**Test 8 — owning educator `GET /submissions?assignmentId=` reflects the state changes:**
**Result:** PASS — `200`, the confirmed student shows `status: "confirmed"` with both timestamps; the other two group members remain `not_submitted`.

**Test 9 — non-owner educator `GET /submissions` (checklist item):**
**Result:** PASS — `403 FORBIDDEN`. (Caught the shared `FORBIDDEN` error copy wrongly read "You do not own this submission" in this assignment-ownership context — fixed to a generic "Forbidden" message before finalizing, since the same error code covers both assignment-ownership and submission-ownership checks.)

**Test 10 — student attempts `GET /submissions` (educator-only route):**
**Result:** PASS — `403 FORBIDDEN` via `requireRole`.

**Test 11 — educator attempts `GET /submissions/mine` (student-only route):**
**Result:** PASS — `403 FORBIDDEN` via `requireRole`.

**Test 12 — `submit` on a nonexistent submission id:**
**Result:** PASS — `404 SUBMISSION_NOT_FOUND`.

**Test 13 — unauthenticated `submit`:**
**Result:** PASS — `401 UNAUTHENTICATED`.

**Test 14 — `GET /submissions` for a nonexistent `assignmentId`:**
**Result:** PASS — `404 ASSIGNMENT_NOT_FOUND`.

**Notes:** Stack torn down (`docker compose down`) after verification. `nodemon` picked up the `FORBIDDEN` message fix live inside the running container, no rebuild needed — re-verified test 9 after the fix. **Phase 6 (two-step submission) is now fully tested — all of core CRUD (Phases 1–6) is complete.** Next up per the build order: Phase 7 (read-only dashboards, both roles).

---

## 2026-08-19 — Phase 7: `GET /reports`, `GET /reports/dashboard`

**Context:** Phase 7, the final phase — read-only views over already-tested data, per `docs/schema.md`'s "no standalone reports table" design. Added migration `007_create_group_progress_view.sql`, applying the `group_progress` SQL view exactly as documented in `schema.md` (was documented but never migrated before this phase). Clarified two response-shape ambiguities in `docs/api.md` with the user before building: `?groupId=` returns `members: [{ studentId, name, completionRate, assignments: [{ id, title, status }] }]` (per-member breakdown, each computed the same way as the `?studentId=` report) rather than the view's raw per-assignment grain; the `group_progress` view itself is used for the dashboard's `groupSummaries` instead, which fits its (group, assignment) grain naturally. `completionRate` for a student/group is `confirmed / total` submissions (0 when there are none, not `NaN`/`null`).

**Test 1 — `?studentId=` as the student themself (self-access):**
**Result:** PASS — `200 { assignments: [...], completionRate }`.

**Test 2 — `?studentId=` for a different student (checklist item):**
**Result:** PASS — `403 FORBIDDEN`.

**Test 3 — `?studentId=` as any educator (checklist item):**
**Result:** PASS — `200`, same shape, no ownership restriction (educators can view any student).

**Test 4 — `?groupId=` as the group leader (a member):**
**Result:** PASS — `200 { members: [...], completionRate }`, per-member breakdown with each member's own assignment list.

**Test 5 — `?groupId=` as a genuine non-member student (checklist item):**
**Result:** PASS — `403 FORBIDDEN`. (First run reused a student who turned out to already be a group member — false pass; caught it, registered a fresh `outsider@test.com` with no group ties, and re-ran to confirm the real 403.)

**Test 6 — `?groupId=` as any educator:**
**Result:** PASS — `200`, no membership restriction for educators.

**Test 7 — `?groupId=` for a nonexistent group:**
**Result:** PASS — `404 NOT_FOUND`.

**Test 8 — both `studentId` and `groupId` provided:**
**Result:** PASS — `400 VALIDATION_ERROR`, Zod `.refine()` rejects before hitting the service.

**Test 9 — neither param provided:**
**Result:** PASS — `400 VALIDATION_ERROR`.

**Test 10 — `/reports/dashboard` as the owning educator:**
**Result:** PASS — `200 { totalAssignments, totalStudents, avgCompletionRate, groupSummaries }`, numbers matched the known test data (9 assignments, 3 distinct students with submissions, 1 group summary).

**Test 11 — `/reports/dashboard` as a different educator with no assignments:**
**Result:** PASS — `200` with all zeros/empty array, confirming the dashboard is scoped to `created_by`, not global.

**Test 12 — `/reports/dashboard` as a student (checklist item):**
**Result:** PASS — `403 FORBIDDEN` via `requireRole`.

**Test 13 — unauthenticated `?studentId=`:**
**Result:** PASS — `401 UNAUTHENTICATED`.

**Bug caught and fixed mid-test:** `groupSummaries` rows initially returned the raw `completion_rate` column (snake_case) while every other field in the same `/reports/dashboard` response was camelCase (`totalAssignments`, `avgCompletionRate`) — an inconsistent response shape. Fixed by mapping the row to `{ id, name, completionRate }` in `reportService.js` before returning; re-verified test 10 after the fix (`nodemon` picked it up live, no rebuild).

**Notes:** Stack torn down (`docker compose down`) after verification. **Phase 7 (dashboards) is now fully tested — all 7 phases of the build order are complete.**

---

## 2026-08-19 — Bug fix: `GET /submissions/mine` missing `id`

**Context:** Discovered while building the Postman collection (docs/postman.md task) — walking the student flow end-to-end as a real client would, not via direct `psql` lookups like the curl tests used. `PATCH /submissions/:id/submit` and `/confirm` both require the submission's `id` in the path, but `GET /submissions/mine` never returned it — a student had no way to discover their own submission's `id` through the documented API at all (Phase 6's curl tests only worked because I pulled the id via `psql`, masking the gap). One-line fix: added `id` to the `SELECT` in `getMine()` (`submissionService.js`). Updated `docs/api.md`'s `/submissions/mine` row to include `id` in the response shape.

**Test — `GET /submissions/mine?assignmentId=` after the fix:**
**Result:** PASS — `200 {"id": "...", "status": "confirmed", "submitted_at": "...", "confirmed_at": "..."}`. `nodemon` picked up the change live.

**Notes:** Stack torn down (`docker compose down`) after verification.

---

## 2026-08-19 — Postman collection: full happy-path walkthrough

**Context:** All curl testing (Phases 1–7) had already passed, so per `CLAUDE.md` it was time to write the Postman guide. Built `postman/task-1-api.postman_collection.json` (6 folders: Auth, Groups, Assignments, Submissions, Reports & Dashboard, Error Cases) and `postman/task-1-local.postman_environment.json`, plus `docs/postman.md` explaining import/setup, the local email-verification shortcut, and the file-upload caveat (Postman collections can't embed a portable file path). Building it end-to-end as a real client would — not via direct `psql` lookups the way the curl tests sometimes did — is what surfaced the `/submissions/mine` `id` bug logged just above.

**Test — full flow walked manually via curl, mirroring the collection's request sequence exactly (register x3 → verify via psql → login x3 → create group → add member → create assignment → assign to group → list as student → get own submission → submit → confirm → educator submissions list → student report → group report → dashboard):**
**Result:** PASS at every step — response shapes and status codes matched what the collection's test scripts assert.

**Caught and fixed while building:** the "Confirm before Submit (409)" error-case request was originally written as a passthrough GET with a misleading description telling the user to manually chain a second request — a stub, not something that actually demonstrates the 409. Split it into a real two-request sequence (fetch the group member's still-`not_submitted` submission id, then `PATCH .../confirm` on it directly) so it's sendable and actually asserts `409 INVALID_STATE`. Re-verified via curl after the fix.

**Notes:** Stack torn down (`docker compose down`) after verification. Test accounts created for this walkthrough (`postman.educator@example.com`, `postman.leader@example.com`, `postman.member@example.com`) remain in the DB volume alongside the earlier phase-test accounts. **Postman guide is now complete and verified.**

---

## 2026-08-19 — Frontend build (Vite + React 19 + React Router v7 + Tailwind v4) and integration testing

**Context:** Built out `frontend/` from scratch — every page in `docs/api.md`: Login/Register/Verify, student Dashboard/Groups/AssignmentDetail/Reports, educator Dashboard/Assignments/AssignmentForm/AssignmentDetail/Reports. Vite dev server proxies `/api` to the backend (host port 5050, per `docker-compose.yml`'s `BACKEND_HOST_PORT`). Verified against the real backend + Postgres stack rather than mocks, first via curl, then via the Claude-in-Chrome browser tool against the actual running dev server (backend restrictions on browser skills/tools were lifted by explicit user request for this task).

**Bugs found and fixed while integration-testing (all confirmed broken via curl/browser before fixing, re-verified after):**
1. **`GET /users/search?email=` documented in api.md but never implemented.** Added `search()` to `userController.js` + route with `validateQuery` in `users.js`. Needed by both the group add-member flow and educator assignment-targeting-by-email flow.
2. **Assignments/submissions endpoints returned raw Postgres snake_case** (`due_date`, `onedrive_link`, `attachment_url`, `created_by`, `student_id`, `submitted_at`, `confirmed_at`) instead of the camelCase api.md documents. Added row-mapping in `assignmentService.js` and `submissionService.js`. Also fixed an internal reference (`getOwnedAssignment`'s `existing.created_by` check) that broke once the mapped shape changed.
3. **`onedrive_link` was `NOT NULL` in the DB and required (`z.url()`, no `.optional()`) in the Zod create schema**, blocking assignments with no OneDrive link (file-upload-only assignments). Added migration `008_alter_assignments_onedrive_link_nullable.sql`, made the Zod field `.optional()`, and defaulted to `null` in `createAssignment`'s insert (node-postgres throws on `undefined` params).
4. **Frontend-only bug caught live in the browser:** `AssignmentForm.jsx` always sent `onedriveLink: ''` in the POST/PUT body even when the field was left blank, which failed `z.url()` validation with "Invalid URL". Fixed by coercing empty string to `undefined` before sending (dropped from the JSON body entirely).

**Test — curl, full flow (register → verify via `psql` UPDATE → login → create assignment w/ and w/o onedriveLink → assign to student → submit → confirm → educator submissions list → dashboard → group fan-out with a 2-member group, confirmed exactly 2 submissions rows → group report):**
**Result:** PASS at every step after the fixes above, including camelCase field names matching what the frontend consumes.

**Test — browser, full UI walkthrough via Claude-in-Chrome (register educator → register student → verify via `psql` UPDATE → login as educator → create assignment via form → assign to student by email → login as student → view dashboard → two-step submit/confirm → view own report → create group as student → verify leader-only Delete/Add controls render → login as educator → verify dashboard reflects live numbers):**
**Result:** PASS at every step, including the live re-verification of the `onedriveLink` frontend fix (form submit failed with "Invalid URL" before the fix, succeeded after — no page reload needed, Vite HMR + backend `nodemon` both picked up the changes live).

**Notes:** Docker stack and Vite dev server both torn down after verification. Browser-test accounts (`browser.edu@test.com`, `browser.stu@test.com`) and their group/assignment data remain in the DB volume alongside earlier test data.

---

## 2026-08-19 — Bulk seed data, UUID-in-UI cleanup, groups/assignment UX parity, submission-flow UX, confirmation modals

**Context:** User asked for realistic seed data (3 educators with 2/3/4 assignments each, 15 students randomly assigned, multiple assignments per student) to manually click through in the browser, kept stack running (not torn down) for a live manual review session. Several rounds of user feedback followed as they clicked through; each is logged separately below. Docker stack + Vite dev server were left running throughout this entire session per explicit instruction — not torn down between rounds.

**Seeding — 3 educators, 15 students, 9 assignments, random individual targeting:**
Wrote a Python seed script (`scratchpad/seed.py`) since bulk registration/login hits the `strictLimiter` (5 req/60s) on `/auth/register` and `/auth/login` — paced in batches of 5 with 62s waits. First run undercounted: `strictLimiter()` creates one rate-limit bucket per route for the server's lifetime, but the script's `paced()` helper reset its own counter between the educators-loop and students-loop calls, so the second call started fresh while the server-side bucket was still burning through the first loop's budget — hit 429 mid-run. Fixed by combining educators+students into one continuous list for both registration and login so the pacing counter matches the server's actual continuous budget. Also caught a manual data-entry bug: `FIRST_NAMES` had 16 entries instead of the requested 15, producing a 16th student ("Anika") — deleted her plus her `assignment_targets` rows (had to delete children before the user row; `assignment_targets.student_id` has no `ON DELETE CASCADE`) before the user could see it.
**Result:** PASS — verified via direct `psql` query (not just script exit code): 3 educators, 15 students, assignment counts per educator exactly 2/3/4, 9 assignments total, each with 3-7 randomly targeted students (individual `targetType: student`, not groups).

**Round 1 feedback — "names not UUIDs, educators should assign from a list of all students (same-school assumption), remove UUID display":**
Bugs found and fixed:
1. Student "Your Progress" and educator "Reports" pages were rendering `a.id` instead of `a.title` in the assignment list — a frontend display bug only; the backend (`reportService.js`) already returned `title`.
2. Educator's per-assignment "Submission status" list rendered raw `s.studentId` — backend genuinely didn't return a name. Added a `JOIN users` + `student_name` to `submissionService.js`'s `listForAssignment` query, mapped to `studentName` in the response.
3. No endpoint existed to list all students for a dropdown. Added `GET /users?role=student|educator` (was educator-only at first, later opened to any authenticated user — see Round 2) and used it to replace the educator's "Student (by email)" text input with a `<select>`.
4. User also opted to extend the same fix to the educator Reports lookup (`?studentId=`/`?groupId=`) — added `GET /groups` (list-all, educator-only at the time) and replaced both raw-ID text inputs with name dropdowns.
**Test:** Verified via curl (`GET /users?role=student` returns names+emails, `GET /submissions?assignmentId=` now includes `studentName`) then confirmed no remaining `.id`-as-display-text patterns via `grep` across `frontend/src` (all remaining `.id` usages are internal — API path params, React `key` props — not visible UI text).
**Result:** PASS.

**Round 2 feedback — "do the same for groups too; seed 1-2 groups and a group-targeted assignment; gate submission behind the OneDrive link; add confirmation modals to the two-step submit/confirm and to every create/delete action site-wide":**
- Opened `GET /users?role=` from educator-only to any authenticated user, so student group-leaders can also use it (removed `requireRole('educator')` from that route).
- Student "Add member" (`Groups.jsx`) switched from a typed email input to a `<select>` of students not already in the group (per user's explicit choice between "only non-members" vs "all + rely on 409" — picked non-members-only).
- Built one reusable `ConfirmDialog` component (native `<dialog>` + `showModal()` — no added dependency) and a `useConfirm()` hook, wired into: create assignment (not edit), create group, add group member, remove group member, delete group, delete assignment, assign-to-student/group, and both submit/confirm steps on the student assignment page. Login/Register deliberately excluded (account creation isn't a "management" action) — user didn't object when this exclusion was flagged.
- Student assignment page: when `assignment.onedriveLink` is set, shows the link plus a required "I've uploaded my work to the link above" checkbox that disables "Yes, I have submitted" until checked (user's explicit pick over "just show the link, no gate" — chose the checkbox-acknowledgment option since actual upload can't be verified without real OneDrive integration, which is out of scope).
- Seeded 2 groups from the existing 15 students (`scratchpad/seed_groups.py`): Team Alpha (leader Ananya + 4 members) and Team Beta (leader Riya + 4 members), added a sample OneDrive link to one existing assignment ("Data Structures Assignment (Sen)"), and created a new group-targeted assignment ("Team Project: Research Report") assigned to Team Alpha.
**Test:** Fan-out verified via `GET /submissions?assignmentId=` immediately after the group-assign call — 5 rows, matching Team Alpha's 5 members exactly. Group membership and the `onedrive_link` column value both re-verified directly via `psql` (bypassing the rate-limited `/auth/login` curl path, which hit `429` mid-check from the seed script's own login calls — confirmed the 429 was expected rate-limiting behavior, not a bug, by re-checking via direct DB query instead of waiting out the window).
**Result:** PASS.

**Round 3 feedback — "group by name is not fixed yet, educator cannot search using group name":**
This was a different spot than Round 1's Reports-lookup fix: the "Assign to → Group" field on the educator's assignment detail page still took a raw Group ID text input — deliberately left as-is in Round 1 since the user hadn't flagged it then. Replaced with a `<select>` of group names (same `GET /groups` endpoint already added for the Reports lookup).
**Result:** PASS — confirmed via `pnpm build` (clean) and Vite HMR picking up the change live (no server restart needed, per the earlier pattern in this session).

**Round 4 — "clean every other database entry other than this session's entries":**
Identified the cutoff by `created_at`: everything from `browser.edu@test.com` (14:02:03) onward belongs to this session (browser-testing round + seed data + whatever the user created manually while clicking through, e.g. a group named "team new" that wasn't part of any seed script). Everything before that timestamp was leftover from prior conversation sessions (Phase 0-7 curl tests, Postman walkthrough, earlier UUID-fix browser testing accounts like `outsider@test.com`, `postman.*@example.com`).
Deleted in one transaction, in FK-safe order (verified before commit): `assignment_targets` referencing old users or old-user-owned groups first (no `ON DELETE CASCADE` on `student_id`/`group_id` there) → old groups (cascades `group_members`) → old assignments (cascades their own `assignment_targets` + `submissions`) → old users (cascades remaining `submissions`/`group_members`).
**Test — row counts before/after, and a full re-listing of remaining users/groups/assignments:**
**Result:** PASS — 16 old users, 6 old groups, 13 old assignments, 7 stray `assignment_targets` removed. Remaining state confirmed clean: exactly 20 users (`browser.edu@test.com`, `browser.stu@test.com`, `educator1-3@seed.test`, `student1-15@seed.test`), 4 groups (Team Alpha, Team Beta, Browser Test Group, "team new"), 11 assignments, 48 `assignment_targets`, 52 `submissions` — all traceable to this session's users only.

**Notes:** Docker stack (`task-1-postgres-1`, `task-1-backend-1`) and the Vite dev server (`localhost:5173`) were kept running throughout and are still up as of this entry — user is continuing manual browser testing. Stack will be torn down and this log updated once they confirm they're done.

---

## 2026-08-22 — Course-centric refactor, Task 2: migrations 009-016

**Context:** `task-2-ui-ux-enhancements` branch, course-centric architecture refactor. Applied the 8 new migration files (courses, course_enrollments, assignments/groups/submissions alters, `assignment_targets` drop, `group_progress` rebuild) against a real Postgres instance before committing, per the project's "test constraints directly against Postgres" build-order convention. Backend/frontend not running for this check — postgres-only.

**Setup:** `docker compose up -d postgres`, then `docker compose run --rm backend pnpm migrate` (existing `pgdata` volume already had 001-008 applied from prior sessions, so this run only applied 009-016).

**Test 1 — schema shape:** `\d` on each altered/new table — confirmed all new columns, CHECK constraints, FKs, and the rebuilt `group_progress` view matched `docs/schema.md` exactly. Confirmed `assignment_targets` no longer exists (`\dt assignment_targets` → not found).

**Test 2 — constraint enforcement (expect failure):**
```sql
INSERT INTO assignments (..., type) VALUES (..., 'group');  -- no num_groups
```
**Result:** PASS — rejected by `assignments_group_requires_num_groups` CHECK.

```sql
INSERT INTO submissions (..., status) VALUES (..., 'confirmed');  -- old 3-state value
```
**Result:** PASS — rejected by `submissions_status_check` (new 4-state enum only).

**Test 3 — group fan-out + `group_progress` view:** Inserted a course, enrollment, published group assignment (`num_groups=1`), one group with a leader `group_members` row, one `submissions` row (`group_id` set, `status='waiting_for_grading'`). Queried `group_progress` → `completion_rate = 0` (correct, none graded yet). Updated the row to `status='graded'` → re-queried → `completion_rate = 1`.
**Result:** PASS.

**Cleanup:** `TRUNCATE` all affected tables to clear test rows (schema kept, no data left behind), `docker compose down` (container + network removed, no lingering daemon).

---

## 2026-08-22 — Course-centric refactor, Task 3: courses backend (CRUD, self-enroll, detail)

**Context:** Same branch. Added `backend/src/{routes,controllers,services}/courses.js` family (course CRUD for professors incl. active toggle, student self-enroll, "my courses" list, course detail with roster+assignments) and wired into `index.js`. Validated against the full stack (postgres + backend, `docker compose up -d --build`) via curl, going through the real register → DB-verify (bypassed Brevo, no `.env` read — just `UPDATE users SET email_verified = true` for the two test accounts) → login flow to get real JWTs, per the project's curl-testing convention.

**Setup:** `docker compose up -d --build`, backend reachable at `localhost:5050` (`BACKEND_HOST_PORT` override, see 2026-08-19 entry). Registered `prof.course.test@test.com` (educator) and `stu.course.test@test.com` (student), verified both directly via `psql`, logged in via `POST /auth/login` for real tokens.

**Tests run (all via curl against `localhost:5050/api/v1/courses`):**
1. `POST /courses` as educator → 201, course created. As student → 403 FORBIDDEN. Missing `title` → 400 VALIDATION_ERROR.
2. `GET /courses/mine` — educator sees the course they created; student sees `[]` before enrolling.
3. `GET /courses` (browse) — student sees the active course; educator on the same route → 403 (student-only route).
4. `GET /courses/:id` — student not yet enrolled → 403 NOT_ENROLLED. Owning educator → 200 with `roster: []`, `assignments: []`.
5. `POST /courses/:id/enroll` — student → 201. Repeat call → 409 ALREADY_ENROLLED.
6. `GET /courses/:id` after enrolling → 200, roster now includes the student. `GET /courses/mine` for that student now includes the course.
7. `PUT /courses/:id` with `{"active": false}` as owning educator → 200, `active: false`. `GET /courses` (browse) afterward → `[]` (inactive course correctly excluded).

**Result:** PASS — all 7 checks behaved as designed; no code changes needed after the first pass.

**Cleanup:** `TRUNCATE` all test rows, deleted the local token scratch file, `docker compose down` (both containers + network removed).

---

## 2026-08-22 — Course-centric refactor, Task 4: assignments backend (course-scoped, publish, guardrails)

**Context:** Same branch. Rewrote `backend/src/{routes,controllers,services}/assignments.js` for the course-centric model: course-scoped create with type selection (draft-by-default), the publish endpoint (individual fan-out / random-leader group seeding via `ORDER BY random()`), and draft-vs-published edit guardrails. Removed the old `POST /:id/assign` route/controller/service (`assignTarget`) since it targeted the now-dropped `assignment_targets` table — replaced entirely by publish. `reportService.js` still references the dropped table/view; left untouched, that's Task 8.

**Setup:** `docker compose up -d --build`, `localhost:5050`. Registered 2 educators + 3 students, verified via `psql`, logged in for real tokens (same pattern as the Task 3 entry).

**Tests run (all via curl against `localhost:5050/api/v1/assignments`, plus direct `psql` checks):**
1. Course + 3 enrollments set up via the Task 3 endpoints. `POST /assignments` (individual, draft-by-default) as owning educator → 201.
2. `POST /assignments` with `type=group` and no `numGroups` → 400 VALIDATION_ERROR (zod `.refine`). With a `courseId` the requester doesn't own → 403 COURSE_FORBIDDEN.
3. `GET /assignments/:id` as an enrolled student while still `draft` → 404 (drafts are invisible to students, not just forbidden — avoids leaking existence). `GET /assignments` (list) for that student → `[]`.
4. `POST /assignments/:id/publish` → 200, `status: published`, `publishedAt` set. Repeat call → 409 ALREADY_PUBLISHED.
5. Student `GET /assignments/:id` and `GET /assignments` after publish → both return the assignment now.
6. **Individual fan-out** — `psql` check: exactly 3 `submissions` rows, one per enrolled student, `status='not_submitted'`, `group_id` null.
7. `PUT /assignments/:id` on the now-published assignment with `{type:'group', numGroups:5, title:'HW1 Updated'}` → `type`/`numGroups` silently ignored (published guardrail), `title` applied. `DELETE` on it → 409 HAS_SUBMISSIONS.
8. **Group publish, insufficient students** — created a group assignment with `numGroups=5` against only 3 enrolled students, published → 409 NOT_ENOUGH_STUDENTS, no partial rows written (transaction rolled back — verified no stray `groups`/`submissions` rows existed after).
9. Edited `numGroups` down to 2 while still draft (allowed) → published → 200. **Group fan-out** — `psql` check: exactly 2 `groups` rows (assignment-scoped), one `group_members` leader row each, one `submissions` row each (`group_id` set, `status='not_submitted'`) — leaders randomly selected from the 3 enrolled students via `ORDER BY random() LIMIT $n`.

**Result:** PASS — all 9 checks behaved as designed; no code changes needed after the first pass.

**Cleanup:** `TRUNCATE` all test rows, deleted local token/response scratch files, `docker compose down`.

---

## 2026-08-22 — Course-centric refactor, Task 5: groups backend (self-assembly)

**Context:** Same branch. Groups are no longer standalone (per Task 2's migration, `groups.created_by` was dropped and `assignment_id` is NOT NULL), so the old `routes/groups.js` + `groupController.js` + `groupService.js` (manual create/mine/all/detail/add-member/remove-member/delete) were already broken against the new schema — this task replaces them entirely with the self-assembly model documented in `docs/architecture.md` flow 2: `GET /assignments/:id/groups` (list open groups) and `POST /assignments/:id/groups/:groupId/join`. Deleted the old standalone `routes/groups.js` and its `/api/v1/groups` mount in `index.js` (no remaining need for a top-level `/groups` router until Task 6's leader confirm-all).

**Setup:** `docker compose up -d --build`, `localhost:5050`. Registered 1 educator + 4 students (5th hit the known `strictLimiter` 5/60s rate limit, expected per the 2026-08-19 entry — proceeded with 4), verified via `psql`, logged in for real tokens.

**Tests run (all via curl against `localhost:5050/api/v1/assignments/:id/groups...`, plus `psql` checks):**
1. Course + 4 enrollments, group assignment with `numGroups=1` created and published (random leader seeding already covered in the Task 4 entry).
2. `GET /assignments/:id/groups` on the still-draft assignment → 404 ASSIGNMENT_NOT_FOUND (drafts hidden). After publish → 200, 1 group with the seeded leader.
3. Seeded leader tries to join their own group again → 409 ALREADY_IN_GROUP.
4. A different enrolled student joins → 201. Repeat join → 409 ALREADY_IN_GROUP. Group listing afterward shows both members with correct roles (leader/member).
5. Educator tries to join → 403 (route is `requireRole('student')`).
6. Join against a random non-existent group id → 404 GROUP_NOT_FOUND.
7. `psql` check: exactly 2 `submissions` rows for the assignment (leader + joiner), both `group_id` set to the joined group, `status='not_submitted'`.

**Result:** PASS — all 7 checks behaved as designed. Did not re-test the non-enrolled-student FORBIDDEN path here (registration for a fresh outsider account hit the same rate limiter mid-run) since it exercises the identical `isEnrolled` check already verified for courses (Task 3) and assignments (Task 4) — judged redundant rather than worth a 60s rate-limit wait.

**Cleanup:** `TRUNCATE` all test rows, deleted local token scratch file, `docker compose down`.

---

## 2026-08-22 — Course-centric refactor, Task 6: submissions backend (confirm terminal status, grading, leader confirm-all)

**Context:** Same branch. `submit()` in `submissionService.js` was already correct for the new model (not_submitted -> pending_confirmation) and needed no change. Rewrote `confirm()` to land on `waiting_for_grading` instead of the old `confirmed` (removed from the enum in Task 2) and to reject group-assignment submissions (`group_id IS NOT NULL`) with a new `NOT_INDIVIDUAL` error - those are swept by the leader instead. Added `grade()` (educator-only, `waiting_for_grading` -> `graded`). Added `confirmAllForGroup()` to `groupService.js` and recreated `routes/groups.js` (removed in Task 5 since nothing needed a top-level `/groups` route yet) to host `POST /groups/:id/confirm-all`, per `docs/architecture.md` flow 3.

**Setup:** `docker compose up -d --build`, `localhost:5050`. Registered 1 educator + 2 students, verified via `psql`, logged in for real tokens.

**Tests run (individual path, all via curl against `localhost:5050/api/v1/submissions`):**
1. `PATCH /:id/confirm` before submit → 409 INVALID_STATE. `PATCH /:id/grade` before confirm → 409 INVALID_STATE.
2. `PATCH /:id/submit` → 200, `pending_confirmation`.
3. A different student tries to confirm the first student's submission → 403 FORBIDDEN (ownership check).
4. Owning student confirms → 200, `waiting_for_grading` (not the old `confirmed`).
5. Educator grades → 200, `graded`. Grading again → 409 INVALID_STATE (no double-grading).

**Tests run (group path, via curl against `localhost:5050/api/v1/submissions` and `/api/v1/groups`):**
6. Group assignment (`numGroups=1`) published; identified the randomly-seeded leader from `GET /assignments/:id/groups`, had the other student join.
7. Member submits → `pending_confirmation`. Member tries to self-confirm → 409 NOT_INDIVIDUAL (group submissions only move via leader confirm-all).
8. Non-leader member tries `POST /groups/:id/confirm-all` → 403 NOT_LEADER.
9. Leader calls confirm-all while **their own row is still `not_submitted`** (never submitted) → 200, `{updatedCount: 2, notSubmittedStudentIds: [<leader's id>]}` — proceeded anyway per the non-blocking design, swept both rows (leader's own included) to `waiting_for_grading` in one statement. `psql` check confirmed both rows `waiting_for_grading` with `confirmed_at` set. Repeat confirm-all → `{updatedCount: 0}` (nothing left to sweep).
10. Educator graded both group submissions → `graded`; final `psql` count check: 2 rows, both `graded`.

**Result:** PASS — all 10 checks behaved as designed; no code changes needed after the first pass.

**Cleanup:** `TRUNCATE` all test rows, deleted local token scratch file, `docker compose down`.

---

## 2026-08-22 — Course-centric refactor, Task 8: reports/dashboards (skipped Task 7, see notes)

**Context:** Task 7 (notifications) needed no new code - `docs/architecture.md`'s finalized design already needs nothing beyond what Task 4's `listAssignments` already returns (`publishedAt`, filtered/ordered correctly); the "new" badge itself is explicitly client-side. Moved straight to Task 8.

`reportService.js` was the one file still referencing the dropped `assignment_targets`-era status value (`'confirmed'`, removed from the enum in Task 2) and a flat aggregate dashboard shape. Rewrote `getDashboard` to branch by role per `docs/architecture.md`/the plan: educator gets courses taught + a per-assignment status-count breakdown (`notSubmitted`/`pendingConfirmation`/`waitingForGrading`/`graded`), student gets enrolled courses + their own assignment statuses + `completionRate` (now based on `graded`, the new terminal status, not the removed `confirmed`). Opened `GET /reports/dashboard` from educator-only to any authenticated user (role-branched inside, matching the `courses`/`assignments` list convention from earlier tasks) and dropped the unused `group_progress`-view join from the old dashboard query (superseded by the richer per-assignment breakdown). Updated `CLAUDE.md`'s stale `/assignments/:id/assign` API-convention example to `/publish`, and documented the new dashboard shape.

**Setup:** `docker compose up -d --build`, `localhost:5050`. Registered 1 educator + 1 student, verified via `psql`, logged in for real tokens.

**Tests run (via curl against `localhost:5050/api/v1/reports`):**
1. Course + enrollment + published individual assignment. Educator dashboard right after publish → 1 assignment, `notSubmitted:1`, all other counts 0. Student dashboard → `status:'not_submitted'`, `completionRate:0`.
2. Student submits + confirms (self, individual path) → educator dashboard recount: `waitingForGrading:1`, `notSubmitted:0`.
3. Educator grades → educator dashboard: `graded:1`. Student dashboard: `status:'graded'`, `completionRate:1`.
4. `GET /reports?studentId=<self>` as the student → matches dashboard data. Same query as the educator (any student) → same data (educators can view any student's drill-down, unchanged from the original design). Student querying a different (fake) `studentId` → 403 FORBIDDEN (ownership check intact).

**Result:** PASS — all 4 checks behaved as designed; no code changes needed after the first pass.

**Cleanup:** `TRUNCATE` all test rows, deleted local token scratch file, `docker compose down`.
