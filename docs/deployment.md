# Deployment

## Local Development (Docker Compose)

Three services: `postgres`, `backend`, `frontend`. Two independent Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`) — no monorepo workspace tooling, each folder is its own build context.

```bash
cp .env.example .env   # fill in real values
docker compose up --build
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

### Steps
1. Push repo to GitHub (Railway deploys from a connected repo).
2. In Railway: create a new project, add a PostgreSQL plugin/addon (Railway provisions `DATABASE_URL` automatically — use this instead of manually assembling from DB_USER/PASSWORD/NAME in prod).
3. Add a persistent volume for `backend/uploads` (Railway Volumes) — without this, uploaded files are lost on every redeploy since Railway's filesystem is otherwise ephemeral.
4. Set environment variables in Railway's service settings: `JWT_SECRET`, `BREVO_API_KEY`, `FRONTEND_ORIGIN` (set to the deployed URL itself, since it's a single service), `NODE_ENV=production`.
5. Build step: `pnpm install && pnpm run build` for the frontend, output copied into (or built directly into) a static folder the Express server serves via `express.static`.
6. Run database migrations against the Railway Postgres instance (one-off run, not part of the container's default start command — avoids accidentally re-running migrations on every restart).
7. Confirm the deployed URL serves the frontend at `/` and API at `/api/v1/*` from the same origin — this is why CORS configuration differs between dev (`localhost:5173` calling `localhost:5000`, cross-origin) and prod (same-origin, CORS largely moot but still explicitly configured for defense-in-depth).

## Dev vs Prod Differences
| | Dev | Prod |
|---|---|---|
| Frontend serving | Vite dev server, hot reload | Static build served by Express |
| Database | Local Docker Postgres | Railway Postgres addon |
| File storage | Docker named volume | Railway persistent volume |
| CORS origin | `http://localhost:5173` | Same-origin (single service) |
| NODE_ENV | development | production |
