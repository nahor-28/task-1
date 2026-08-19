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
