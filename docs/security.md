# Security

## Authentication
- JWT, signed with a server-side secret (`JWT_SECRET` env var, never committed).
- Access token only, ~1hr expiry. No refresh token.
- **Known limitation, stated explicitly:** logout does not invalidate a token before its natural expiry — there is no server-side token blocklist/revocation store. A stolen token remains valid for up to 1 hour after logout. This is an accepted tradeoff for assessment scope, not an oversight. A production system would add a refresh-token rotation scheme with revocable server-side storage.
- Payload: `{ userId, role }`. Role is embedded in the token and re-verified against the `users` table on sensitive operations where staleness matters (e.g. after a hypothetical role change — not applicable in this MVP since roles are immutable post-registration).

## Password Handling
- bcrypt, cost factor 10 (default). Never stored or logged in plaintext at any point, including in error messages or console output during development.

## Email Verification
- Brevo transactional email with a signed, time-limited verification token.
- Token stored server-side keyed to the user (or a separate `email_verification_tokens` table if resend functionality is implemented — avoids mutating the `users` row on resend).
- Unverified users can register and receive a token but are blocked from role-specific actions (enrolling in a course, creating an assignment) until `email_verified = true`, enforced at the middleware layer.

## Authorization
Two layers, both required — role check alone is insufficient:
1. **Role check** — is this user a student or educator, does this route permit that role.
2. **Ownership check** — e.g. a student can only confirm their own `submissions` row, not another student's; an educator can only edit an `assignments` row they created; a group leader check is required before sweeping a group's submissions via confirm-all.

Missing the ownership layer (role check only) is a common vulnerability class in role-based systems and is explicitly guarded against in every mutating endpoint — see `api.md` for per-endpoint authorization requirements.

## Rate Limiting
Tiered, not flat, to avoid throttling normal frontend use (React re-fetch on mount/focus):

| Tier | Endpoints | Limit |
|---|---|---|
| Strict | `/auth/register`, `/auth/login` | 5 requests / minute / IP |
| Moderate | Write endpoints (create/update/delete) | 30 requests / minute / IP |
| Loose | Read endpoints (dashboard, list, detail views) | 100 requests / minute / IP |

Implemented via `express-rate-limit`, applied per-router rather than globally.

## Input Validation
All request bodies validated at the middleware layer before reaching controllers (library: `zod` or `joi` — pick one, apply consistently). Rejects malformed input before any DB query is attempted. Applies to every mutating endpoint without exception.

## File Upload Constraints
- Multer, disk storage (local volume in dev, Railway volume in prod).
- MIME type whitelist: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx) only.
- File size cap: 10MB (adjust if needed, but must be explicit — unbounded upload size is a denial-of-service vector).
- Uploaded filenames are never trusted directly — stored with a generated UUID filename, original name kept as metadata only, to prevent path traversal or overwrite attacks.

## Database
- All queries parameterized (`$1, $2...` placeholders via `pg`), never raw string interpolation — prevents SQL injection.
- Foreign key constraints and CHECK constraints enforced at the database level, not application-only — see `schema.md`. This means even a bug in application logic cannot insert data that violates a relational invariant (e.g. a group-type `assignments` row with `num_groups` left null, or a `submissions` row with a status value outside the 4-state enum).

## CORS
Backend allows requests only from the known frontend origin (configured via env var, differs between local Docker and Railway prod) — not a wildcard `*`.

## Known Limitations (stated deliberately, not hidden)
- No JWT revocation/refresh mechanism.
- No rate-limit persistence across server restarts (in-memory store; acceptable for single-instance assessment deployment, would need Redis-backed store for horizontal scaling).
- No formal automated security testing (e.g. dependency vulnerability scanning) — out of scope for assessment timeline.
- No minimum-group-size enforcement server-side — a group can be confirmed with just its seeded leader and no other members. The "at least 2 members" nudge is UI-only (non-blocking), a deliberate scope decision, not an oversight — see `CLAUDE.md`.
