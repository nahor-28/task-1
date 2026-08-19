# API Reference

Base path: `/api/v1`. All request/response bodies are JSON unless noted (file upload is multipart/form-data). All timestamps ISO 8601. Auth via `Authorization: Bearer <token>` header unless marked public.

Status codes used consistently: `200` success, `201` created, `400` validation error, `401` unauthenticated, `403` unauthorized (role or ownership), `404` not found, `409` conflict (e.g. duplicate email), `429` rate limited, `500` server error. Error response shape:
```json
{ "error": { "message": "string", "code": "MACHINE_READABLE_CODE" } }
```

## Auth

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | `{ name, email, password, role }` | `201 { userId }` | role: 'student' \| 'educator'. Triggers Brevo verification email. Rate: strict tier. |
| GET | `/auth/verify?token=` | Public | — | `200 { verified: true }` | Sets `email_verified = true`. |
| POST | `/auth/login` | Public | `{ email, password }` | `200 { token, user: { id, name, role } }` | Rejects if `email_verified = false`. Rate: strict tier. |
| POST | `/auth/logout` | Bearer | — | `200 {}` | Client-side token discard only — see `security.md` re: no server-side revocation. |

## Users

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/users/me` | Bearer | — | `200 { id, name, email, role }` | Current user profile. |
| GET | `/users/search?email=` | Bearer | — | `200 [{ id, name, email }]` | Used for group member lookup by email/ID. |

## Groups

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/groups` | Bearer (student) | `{ name }` | `201 { groupId }` | Creator becomes leader. |
| GET | `/groups/:id` | Bearer | — | `200 { id, name, members: [...] }` | Ownership: member of group or educator. |
| POST | `/groups/:id/members` | Bearer (leader) | `{ studentId }` | `201 { memberId }` | Direct-add, no accept/decline in MVP. |
| DELETE | `/groups/:id/members/:studentId` | Bearer (leader) | — | `200 {}` | Leader-only. |
| DELETE | `/groups/:id` | Bearer (leader) | — | `200 {}` | Leader-only. |
| GET | `/groups/mine` | Bearer (student) | — | `200 [{ id, name }]` | Groups the current student belongs to. |

## Assignments

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/assignments` | Bearer (educator) | `{ title, description, dueDate, onedriveLink }` | `201 { assignmentId }` | |
| POST | `/assignments/:id/attachment` | Bearer (educator, owner) | multipart file | `200 { attachmentUrl }` | Multer, PDF/docx only, 10MB cap. |
| PUT | `/assignments/:id` | Bearer (educator, owner) | `{ title?, description?, dueDate?, onedriveLink? }` | `200 {...}` | Edit allowed anytime. |
| DELETE | `/assignments/:id` | Bearer (educator, owner) | — | `200 {}` / `409` | Blocked (409) if any `submissions` row exists — archive instead. |
| GET | `/assignments` | Bearer | — | `200 [{...}]` | Educator: assignments they created. Student: assignments targeted at them (individually or via group). |
| GET | `/assignments/:id` | Bearer | — | `200 { ...full detail, attachmentUrl }` | |
| POST | `/assignments/:id/assign` | Bearer (educator, owner) | `{ targetType: 'student' \| 'group', targetId }` | `201 { targetId }` | Single endpoint for both target types (not separate routes). Triggers submissions fan-out if targetType is 'group'. |

## Submissions

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/submissions?assignmentId=` | Bearer (educator, owner) | — | `200 [{ studentId, status, submittedAt, confirmedAt }]` | Per-assignment status list for educator tracking. |
| GET | `/submissions/mine?assignmentId=` | Bearer (student) | — | `200 { status, submittedAt, confirmedAt }` | Current student's own submission for an assignment. |
| PATCH | `/submissions/:id/submit` | Bearer (student, owner) | — | `200 { status: 'pending_confirmation' }` | Step 1: "Yes, I have submitted." Fails 409 if not currently `not_submitted`. |
| PATCH | `/submissions/:id/confirm` | Bearer (student, owner) | — | `200 { status: 'confirmed' }` | Step 2: final confirm. Fails 409 if not currently `pending_confirmation`. |

## Reports

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/reports?studentId=` | Bearer (educator, or self if student) | — | `200 { assignments: [{ id, status }], completionRate }` | Query param variant, not separate path per entity type. |
| GET | `/reports?groupId=` | Bearer (educator, or member if student) | — | `200 { members: [...], completionRate }` | Backed by SQL view — see `schema.md`. |
| GET | `/reports/dashboard` | Bearer (educator) | — | `200 { totalAssignments, totalStudents, avgCompletionRate, groupSummaries: [...] }` | Aggregate for the educator dashboard/analytics view. |

## Conventions Recap
- REST resources over RPC-style paths: `POST /assignments/:id/assign` with a `targetType` discriminator in the body, not `/assign/[studentId]` and `/assign/[groupId]` as separate routes.
- Reports use query params (`?studentId=` / `?groupId=`) against one endpoint, not one endpoint per entity type.
- Every mutating endpoint enforces both role check and ownership check (see `security.md`) — "Bearer (educator, owner)" in the tables above means both are checked.
- Rate limit tier per endpoint documented in `security.md`; not repeated per-row here to avoid duplication.
