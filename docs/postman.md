# Postman Guide

Written after all curl testing in `docs/testing-log.md` passed (Phases 1–7), per `CLAUDE.md`. The Postman collection exercises the same endpoints already verified by curl — it's a convenient way to explore or demo the API, not a second independent test pass.

## Files

| File | Purpose |
|---|---|
| `postman/task-1-api.postman_collection.json` | The collection — 6 folders, run top-to-bottom. |
| `postman/task-1-local.postman_environment.json` | Variables the collection reads/writes (`baseUrl`, tokens, IDs). |

## Import

1. Postman → **Import** → drag in both files (or File → Import).
2. Top-right environment selector → choose **task-1 (local)**.
3. Confirm `baseUrl` matches your setup:
   - Documented default port: `http://localhost:5000/api/v1`.
   - **This Mac specifically** uses `BACKEND_HOST_PORT=5050` (port 5000 is taken by AirPlay Receiver) — edit the environment's `baseUrl` to `http://localhost:5050/api/v1` before running, or use whatever `BACKEND_HOST_PORT` you set in your own `.env`.
4. `docker compose up -d` (and `docker compose exec backend pnpm run migrate` on first boot) before sending any requests.

## Running it

Folders run in order, top to bottom, within each folder. Later requests depend on variables earlier ones capture automatically via test scripts (`pm.environment.set(...)`) — e.g. **Create Group** captures `groupId`, which **Add Member** and everything downstream reuses. You don't need to copy/paste anything by hand except the email verification step below.

**1. Auth** — registers one educator and two students (leader + group member), verifies email, logs all three in and captures their tokens.

**2. Groups (Student)** — the leader creates a group and adds the second student as a member.

**3. Assignments (Educator)** — the educator creates an assignment, optionally uploads an attachment, targets it at the group (triggers the submissions fan-out), then confirms the student now sees it in their list.

**4. Submissions (Student, two-step)** — the leader fetches their own submission id, then walks `submit` → `confirm`. The educator's list request afterward shows the leader as `confirmed` and the member still `not_submitted`, since only the leader ran the two-step flow.

**5. Reports & Dashboard** — student's own report, the group's per-member breakdown, and the educator's dashboard.

**6. Error Cases (illustrative)** — a handful of the auth/ownership/state-conflict responses documented in `docs/api.md` (wrong password → 401, student creating an assignment → 403, confirming before submitting → 409, unknown group → 404, missing auth header → 401). Not exhaustive — the full error-path matrix is in `docs/testing-log.md`.

## Email verification without waiting on Brevo

**Register** sends a real verification email (Brevo is live-configured in this project). Two options for the **Verify Email** request in the collection:

- **Real flow**: open the email, copy the token out of the link's `?token=` query param, paste it into the collection variable `verificationToken` (collection-scope, not the environment — right-click the collection → Edit → Variables), then send.
- **Local shortcut** (what was used throughout this project's own curl testing — see `docs/testing-log.md`): skip the request entirely and flip the flag directly in the dev database:
  ```bash
  docker compose exec -T postgres psql -U devuser -d assignment_tracker \
    -c "UPDATE users SET email_verified = true WHERE email = 'postman.leader@example.com';"
  ```
  Repeat per account (`educatorEmail`, `studentEmail`, `student2Email` from the environment).

## File upload

Postman collections can't embed a file path portably across machines. Before sending **Upload Attachment** (folder 3), open its **Body** tab and select a local PDF or DOCX under 10MB for the `file` field — otherwise it sends with no file and gets a `400 VALIDATION_ERROR` (no file uploaded).

## A note on one endpoint in `docs/api.md`

`GET /users/search?email=` is documented in `docs/api.md` as the intended way to look up a student's ID for group invites, but was never implemented — `POST /groups/:id/members` takes `studentId` directly (a UUID), so the collection captures IDs from the register responses instead (`studentId`, `student2Id`) rather than searching by email. Not included in this collection since it doesn't exist yet; flagged here rather than silently worked around.
