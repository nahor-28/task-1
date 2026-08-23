# Testing

## Approach
Manual verification (curl / Postman / browser), not an automated test suite. This is a deliberate, time-boxed scope decision — priority was given to feature completeness across the full brief rather than test infrastructure. Stated here explicitly rather than left as a silent gap.

If time remains, the first and only automated test worth adding is the group-publish random-leader-seeding + submissions fan-out — it's the one piece of non-trivial business logic where a silent bug would be visible and embarrassing in a live demo, and it's cheap to cover with a single integration test.

## Manual Test Checklist

### 1. Migrations / Schema
- [ ] Run migrations against a clean Postgres instance, confirm all 7 tables created (`users`, `courses`, `course_enrollments`, `groups`, `group_members`, `assignments`, `submissions`).
- [ ] Insert a group-type `assignments` row with `num_groups` left null — confirm CHECK constraint rejects it.
- [ ] Insert a `submissions` row with a status value outside the 4-state enum — confirm CHECK constraint rejects it.
- [ ] Insert a duplicate `submissions` row for the same (assignment_id, student_id) — confirm UNIQUE constraint rejects it.
- [ ] Delete an assignment with groups — confirm `groups`/`group_members` rows cascade-delete, confirm any related `submissions` rows do NOT cascade-delete from a student leaving `group_members` directly (historical data preserved via `student_id` FK).

### 2. Auth
- [ ] Register as student, confirm 201 and Brevo email received.
- [ ] Attempt login before verifying email — confirm rejected.
- [ ] Click verification link, confirm `email_verified = true`, login succeeds.
- [ ] Login with wrong password — confirm 401, confirm no user detail leaked in error message.
- [ ] Repeat register/login flow for educator role.
- [ ] Hit `/auth/login` 6+ times in a minute — confirm 429 on the 6th.
- [ ] Call a protected route with no token — confirm 401. With an expired token — confirm 401.

### 3. Courses
- [ ] Educator creates a course — confirm 201, defaults to `active: true`.
- [ ] Educator toggles a course inactive — confirm it disappears from student browse (`GET /courses`) but stays in already-enrolled students' `GET /courses/mine`.
- [ ] Student browses and enrolls — confirm 201, appears in `GET /courses/mine`, disappears from browse.
- [ ] Student enrolls twice — confirm 409 ALREADY_ENROLLED.
- [ ] Student enrolls in an inactive course — confirm 409 COURSE_INACTIVE.
- [ ] Non-enrolled student requests course detail — confirm 403 NOT_ENROLLED. Non-owning educator requests another educator's course detail — confirm 403.

### 4. Assignments (Educator)
- [ ] Create assignment (individual) — confirm 201, `status: 'draft'`.
- [ ] Create assignment (group) with no `numGroups` — confirm 400 VALIDATION_ERROR.
- [ ] Create assignment against a course the requester doesn't own — confirm 403 COURSE_FORBIDDEN.
- [ ] Upload attachment (valid PDF) — confirm stored, `attachment_url` set.
- [ ] Upload attachment with disallowed MIME type / over size cap — confirm rejected.
- [ ] Edit a draft assignment's `type`/`numGroups` — confirm it takes effect.
- [ ] Edit the same fields after publishing — confirm they're silently ignored (only title/description/dueDate/onedriveLink apply).
- [ ] Attempt delete with zero submissions — confirm succeeds. With at least one submission row — confirm 409, blocked.
- [ ] Attempt edit/delete as a different educator (not the creator) — confirm 403.
- [ ] Student requests a still-draft assignment's detail — confirm 404 (not 403 — avoids leaking existence).

### 5. Publish + Fan-Out (critical path)
- [ ] Publish an individual assignment — confirm exactly one `submissions` row per enrolled student, all `status = 'not_submitted'`.
- [ ] Publish a group assignment with `numGroups` ≤ enrolled student count — confirm exactly `numGroups` `groups` rows created (assignment-scoped), one `group_members` leader row and one `submissions` row per seeded leader.
- [ ] Publish a group assignment with `numGroups` > enrolled student count — confirm 409 NOT_ENOUGH_STUDENTS, no partial `groups`/`submissions` rows left behind (transaction rolled back).
- [ ] Publish the same assignment twice — confirm 409 ALREADY_PUBLISHED on the second call.

### 6. Groups (Self-Assembly)
- [ ] `GET /assignments/:id/groups` on a draft group assignment — confirm 404 (hidden, same as assignment detail).
- [ ] Student joins an open group — confirm `group_members` row (`role='member'`) and `submissions` row created together.
- [ ] Student already in a group for this assignment tries to join a different group — confirm 409 ALREADY_IN_GROUP.
- [ ] Non-enrolled student tries to list/join — confirm 403.
- [ ] Join against a nonexistent group id — confirm 404 GROUP_NOT_FOUND.

### 7. Submissions (Student, two-step) + Leader Confirm-All
- [ ] Call `/submissions/:id/submit` — confirm status moves to `pending_confirmation`, `submitted_at` set.
- [ ] Call `/submit` again on the same row — confirm 409 (already past step 1).
- [ ] Individual submission: call `/confirm` — confirm status moves to `waiting_for_grading`, `confirmed_at` set.
- [ ] Group submission: call `/confirm` — confirm 409 NOT_INDIVIDUAL (group rows only move via leader confirm-all).
- [ ] Attempt `/confirm` on a row still at `not_submitted` (skipping step 1) — confirm 409, two-step order enforced server-side.
- [ ] Attempt to submit/confirm another student's submission row — confirm 403 (ownership check).
- [ ] Non-leader group member calls `POST /groups/:id/confirm-all` — confirm 403 NOT_LEADER.
- [ ] Leader calls confirm-all while at least one member (including possibly themself) is still `not_submitted` — confirm the call still succeeds, sweeps every member row to `waiting_for_grading`, and reports the not-submitted student ids in the response rather than blocking.
- [ ] Repeat confirm-all — confirm `updatedCount: 0` (idempotent no-op once nothing's left to sweep).

### 8. Grading
- [ ] Educator grades a `waiting_for_grading` submission — confirm status moves to `graded`, `graded_at` set.
- [ ] Grade a row not currently `waiting_for_grading` — confirm 409 INVALID_STATE (blocks double-grading and grading-before-confirm).
- [ ] Educator (not the assignment's creator) tries to grade — confirm 403.

### 9. Reports / Dashboards
- [ ] `/reports?groupId=` returns correct completion rate matching manually-counted `graded` rows for that group.
- [ ] `/reports/dashboard` (educator) per-assignment status-count breakdown matches manual counts.
- [ ] `/reports/dashboard` (student) enrolled courses + assignment statuses + completion rate match manual counts.
- [ ] Progress indicators in the UI visually reflect the same numbers returned by the API (spot-check, not pixel-perfect).

## UI State Verification
For each async action (login, register, create course, create assignment, upload, enroll, join group, submit, confirm, confirm-all, grade): manually trigger and confirm the correct UI state renders — `processing` during the request, `success` or `error` after, with the right message for validation failures (400) vs auth failures (401/403) vs conflicts (409).
