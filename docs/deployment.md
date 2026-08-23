# Deployment

## Local Development (Docker Compose)

Two services in `docker-compose.yml`: `postgres`, `backend`. The frontend has no Dockerfile or compose service — it runs via `pnpm dev` (Vite) directly on the host, proxying `/api` to the backend container. `backend/Dockerfile` is dev-only (hot reload via nodemon + host volume mount); production uses a separate `backend/Dockerfile.prod` (see below).

```bash
cp .env.example .env   # fill in real values
docker compose up --build   # postgres + backend
cd frontend && pnpm dev     # separately, on the host
```

Backend: `http://localhost:5000`. Frontend (dev server): `http://localhost:5173`. Postgres: `localhost:5432`.

### Why the Dockerfiles are structured this way
```dockerfile
# backend/Dockerfile
FROM node:20-alpine
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 5000
CMD ["pnpm", "run", "dev"]
```
Manifest files (`package.json`, lockfile) are copied and installed *before* the rest of the source is copied. Docker caches layers — if source code were copied first, every code change would invalidate the install cache and force a full `node_modules` reinstall on every rebuild. This ordering means `pnpm install` only re-runs when dependencies actually change.

### Why compose uses anonymous `node_modules` volumes
```yaml
backend:
  volumes:
    - ./backend:/app
    - /app/node_modules      # anonymous volume, prevents host mount from clobbering container's node_modules
    - uploads:/app/uploads   # named volume, persists uploaded files across container restarts
```
Mounting the host folder for hot-reload (`./backend:/app`) would otherwise overwrite the `node_modules` installed *inside* the container with whatever exists (or doesn't) on the host — a common source of "module not found" errors that look like a pnpm bug but are actually a volume-mount ordering issue.

### Postgres healthcheck
Backend's `depends_on` uses `condition: service_healthy` against Postgres's `pg_isready` healthcheck, not a plain startup-order dependency — Compose's default `depends_on` only waits for the container to *start*, not for Postgres to actually be ready to accept connections. Without the healthcheck gate, the backend can crash-loop on boot trying to connect before Postgres is ready.

### Uploads directory
`backend/uploads/` must exist and be writable inside the container for multer. Created via `mkdir -p` in the Dockerfile or on app boot — first upload attempt will fail with a confusing error if this is skipped.

## Environment Variables
See `.env.example` (committed) for the full list. Never commit the real `.env`. Required at minimum:
```
DB_USER=
DB_PASSWORD=
DB_NAME=
DATABASE_URL=postgres://...   # constructed from above for the backend
JWT_SECRET=
BREVO_API_KEY=
FRONTEND_ORIGIN=               # for CORS
NODE_ENV=development|production
```

## Production Deployment (Railway)

**Topology: single service.** The backend Express server serves the built frontend as static files rather than running two separate Railway services. Reasoning: fewer moving parts to configure (one service, one env var set, one deploy pipeline) for an assessment-scale app with no need for independent frontend/backend scaling.

### How the single service is built
`backend/Dockerfile.prod` is a multi-stage build, separate from the dev-only `backend/Dockerfile`:
1. Stage 1 (`frontend-build`): installs `frontend/`'s deps and runs `pnpm run build`, producing `frontend/dist`.
2. Stage 2: installs backend prod deps only (`pnpm install --frozen-lockfile --prod`), copies backend source, then copies stage 1's `dist` output in as `./frontend-dist`. `CMD` is `pnpm start` (plain `node`, not nodemon).

Because it needs both `frontend/` and `backend/` as build input, **the Docker build context must be the repo root**, not `backend/` — Railway's "Root Directory" setting should stay at the repo root, with "Dockerfile Path" set to `backend/Dockerfile.prod`.

At runtime, `backend/src/index.js` only serves the frontend when `NODE_ENV=production`: `express.static(frontend-dist)` plus a catch-all `app.get('*', ...)` fallback to `index.html`, registered *after* all `/api/v1/*` routes so it can never shadow them.

### Steps
1. Push repo to GitHub (Railway deploys from a connected repo).
2. In Railway: create a new project, deploy from this repo. Set **Root Directory** to the repo root and **Dockerfile Path** to `backend/Dockerfile.prod` in the service's build settings.
3. Add a PostgreSQL plugin/addon (Railway provisions `DATABASE_URL` automatically — use this instead of manually assembling from DB_USER/PASSWORD/NAME in prod).
4. Add a persistent volume mounted at `/app/uploads` (Railway Volumes) — without this, uploaded files are lost on every redeploy since Railway's filesystem is otherwise ephemeral.
5. Set environment variables in Railway's service settings: `JWT_SECRET` (a fresh secret, not the local dev one), `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `NODE_ENV=production`. Leave `FRONTEND_ORIGIN` for the next step.
6. Deploy once to get Railway's assigned URL (or attach a custom domain first), then set `FRONTEND_ORIGIN` to that URL and redeploy — it's used both for CORS and for building the link inside verification emails, so it must be correct before real users register.
7. Run database migrations against the Railway Postgres instance as a one-off (`railway run pnpm run migrate` from `backend/`, or point a local `DATABASE_URL` at the Railway instance and run it from your machine) — not part of the container's default start command, to avoid re-running migrations on every restart.
8. Confirm the deployed URL serves the frontend at `/` and API at `/api/v1/*` from the same origin — this is why CORS configuration differs between dev (`localhost:5173` calling `localhost:5000`, cross-origin) and prod (same-origin, CORS largely moot but still explicitly configured for defense-in-depth).

## Dev vs Prod Differences
| | Dev | Prod |
|---|---|---|
| Frontend serving | Vite dev server, hot reload | Static build served by Express |
| Database | Local Docker Postgres | Railway Postgres addon |
| File storage | Docker named volume | Railway persistent volume |
| CORS origin | `http://localhost:5173` | Same-origin (single service) |
| NODE_ENV | development | production |
