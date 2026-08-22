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
| GET | `/users?role=student\|educator` | Bearer | — | `200 [{ id, name, email }]` | Lists all users of a role. Used to populate the reports-lookup dropdown. |

## Courses

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/courses` | Bearer (educator) | `{ title, description? }` | `201 { courseId }` | |
| PUT | `/courses/:id` | Bearer (educator, owner) | `{ title?, description?, active? }` | `200 {...}` | `active: false` hides it from student browse without deleting. |
| GET | `/courses/mine` | Bearer | — | `200 [{...}]` | Educator: courses they teach. Student: courses they're enrolled in. |
| GET | `/courses` | Bearer (student) | — | `200 [{...}]` | Active courses, for browsing/enrollment. |
| GET | `/courses/:id` | Bearer | — | `200 { ...course, roster: [...], assignments: [...] }` | Educator must own it; student must be enrolled. |
| POST | `/courses/:id/enroll` | Bearer (student) | — | `201 {}` | `409` if already enrolled or course is inactive. |

## Assignments

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/assignments` | Bearer (educator) | `{ courseId, title, description, dueDate, onedriveLink?, type: 'individual'\|'group', numGroups? }` | `201 { assignmentId }` | `numGroups` required when `type='group'`. Must own `courseId`. Draft by default. |
| POST | `/assignments/:id/attachment` | Bearer (educator, owner) | multipart file | `200 { attachmentUrl }` | Multer, PDF/docx only, 10MB cap. |
| PUT | `/assignments/:id` | Bearer (educator, owner) | `{ title?, description?, dueDate?, onedriveLink?, type?, numGroups? }` | `200 {...}` | `type`/`numGroups` only take effect while `status='draft'` — silently ignored once published. |
| DELETE | `/assignments/:id` | Bearer (educator, owner) | — | `200 {}` / `409` | Blocked (409) if any `submissions` row exists — archive instead. |
| GET | `/assignments` | Bearer | — | `200 [{...}]` | Educator: assignments they created (draft + published). Student: published assignments in their enrolled courses. |
| GET | `/assignments/:id` | Bearer | — | `200 { ...full detail, attachmentUrl }` | Educator must own it. Student: only if published and enrolled in its course (draft assignments 404 for students, not 403 — avoids leaking existence). |
| POST | `/assignments/:id/publish` | Bearer (educator, owner) | — | `200 {...updated}` | `individual`: fans out one `submissions` row per enrolled student. `group`: randomly seeds `numGroups` leaders (one `groups` row + leader `submissions` row each). `409 ALREADY_PUBLISHED` / `409 NOT_ENOUGH_STUDENTS`. |
| GET | `/assignments/:id/groups` | Bearer | — | `200 [{ id, name, createdAt, members: [...] }]` | Group-type, published assignments only. Educator must own it; student must be enrolled. |
| POST | `/assignments/:id/groups/:groupId/join` | Bearer (student) | — | `201 {}` | Creates the joining student's `submissions` row. `409 ALREADY_IN_GROUP`. |

## Groups

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/groups/:id/confirm-all` | Bearer (student, leader) | — | `200 { updatedCount, notSubmittedStudentIds }` | Leader-only. Sweeps every member row (including the leader's own) to `waiting_for_grading`, even if some are still `not_submitted` — `notSubmittedStudentIds` reports who, but the sweep proceeds regardless. |

Groups have no standalone CRUD — they're created only by publish (leader-seeded) or by a student joining via the assignment-scoped endpoints above. See `schema.md`.

## Submissions

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/submissions?assignmentId=` | Bearer (educator, owner) | — | `200 [{ id, studentId, studentName, groupId, status, submittedAt, confirmedAt, gradedAt }]` | Per-assignment status list for educator tracking/grading. |
| GET | `/submissions/mine?assignmentId=` | Bearer (student) | — | `200 { id, groupId, status, submittedAt, confirmedAt, gradedAt }` | Current student's own submission. `404` if none exists yet (unjoined group assignment, or enrolled after an individual assignment published). |
| PATCH | `/submissions/:id/submit` | Bearer (student, owner) | — | `200 { status: 'pending_confirmation' }` | Step 1. Fails 409 if not currently `not_submitted`. Same for individual and group submissions. |
| PATCH | `/submissions/:id/confirm` | Bearer (student, owner) | — | `200 { status: 'waiting_for_grading' }` | Individual submissions only — `409 NOT_INDIVIDUAL` if `groupId` is set (group submissions move via leader confirm-all instead). Fails 409 if not currently `pending_confirmation`. |
| PATCH | `/submissions/:id/grade` | Bearer (educator, owner of the assignment) | — | `200 { status: 'graded' }` | Fails 409 if not currently `waiting_for_grading`. |

## Reports

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/reports?studentId=` | Bearer (educator, or self if student) | — | `200 { assignments: [{ id, title, courseId, status }], completionRate }` | `completionRate` is graded / total. |
| GET | `/reports?groupId=` | Bearer (educator, or member if student) | — | `200 { members: [...], completionRate }` | |
| GET | `/reports/dashboard` | Bearer | — | Educator: `200 { courses: [...], assignments: [{ id, title, courseId, assignmentStatus, notSubmitted, pendingConfirmation, waitingForGrading, graded }] }`. Student: `200 { courses: [...], assignments: [...], completionRate }`. | Role-branched, same endpoint. |

## Conventions Recap
- REST resources over RPC-style paths: `POST /assignments/:id/publish` with no body, not an `/assign` action carrying a target payload — targeting is implicit via enrollment/group membership.
- Reports use query params (`?studentId=` / `?groupId=`) against one endpoint, not one endpoint per entity type.
- Every mutating endpoint enforces both role check and ownership check (see `security.md`) — "Bearer (educator, owner)" in the tables above means both are checked.
- Rate limit tier per endpoint documented in `security.md`; not repeated per-row here to avoid duplication.
