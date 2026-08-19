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
