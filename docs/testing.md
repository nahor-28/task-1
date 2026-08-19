# Testing

## Approach
Manual verification (curl / Postman / Thunder Client), not an automated test suite. This is a deliberate, time-boxed scope decision for an assessment project — priority was given to feature completeness across the full brief rather than test infrastructure. Stated here explicitly rather than left as a silent gap.

If time remains after core build (see `claude.md` build order, steps 1–7 complete), the first and only automated test to add is the group-assign submissions fan-out (step 5 below) — it's the one piece of non-trivial business logic where a silent bug would be visible and embarrassing in a live demo, and it's cheap to cover with a single integration test.

## Manual Test Checklist

### 1. Migrations / Schema
- [ ] Run migrations against a clean Postgres instance, confirm all 6 tables created.
- [ ] Insert an `assignment_targets` row with both `student_id` and `group_id` set — confirm CHECK constraint rejects it.
- [ ] Insert an `assignment_targets` row with neither set — confirm CHECK constraint rejects it.
- [ ] Insert a duplicate `submissions` row for the same (assignment_id, student_id) — confirm UNIQUE constraint rejects it.
- [ ] Delete a `group` with members — confirm `group_members` rows cascade-delete, confirm any related `submissions` rows do NOT cascade-delete (historical data preserved).

### 2. Auth
- [ ] Register as student, confirm 201 and Brevo email received.
- [ ] Attempt login before verifying email — confirm rejected.
- [ ] Click verification link, confirm `email_verified = true`, login succeeds.
- [ ] Login with wrong password — confirm 401, confirm no user detail leaked in error message.
- [ ] Repeat register/login flow for educator role.
- [ ] Hit `/auth/login` 6+ times in a minute — confirm 429 on the 6th.
- [ ] Call a protected route with no token — confirm 401. With an expired token — confirm 401.

### 3. Assignments (Educator)
- [ ] Create assignment — confirm 201, row exists.
- [ ] Upload attachment (valid PDF) — confirm stored, `attachment_url` set.
- [ ] Upload attachment with disallowed MIME type — confirm rejected.
- [ ] Upload attachment over size cap — confirm rejected.
- [ ] Edit assignment — confirm fields update.
- [ ] Attempt delete with zero submissions — confirm succeeds.
- [ ] Attempt delete with at least one submission row present — confirm 409, blocked.
- [ ] Attempt edit/delete as a different educator (not the creator) — confirm 403.

### 4. Groups (Student)
- [ ] Create group — confirm creator is leader.
- [ ] Add member by email — confirm added as 'member' role.
- [ ] Attempt member-remove as non-leader — confirm 403.
- [ ] Remove member as leader — confirm removed, confirm their existing `submissions` rows (if any) are untouched.
- [ ] Delete group as leader — confirm cascade to `group_members`, confirm `submissions` rows preserved.

### 5. Assignment Targeting + Submissions Fan-Out (critical path)
- [ ] Assign to a single student — confirm exactly 1 `submissions` row created with `status = 'not_submitted'`.
- [ ] Assign to a group of 3 members — confirm exactly 3 `submissions` rows created, one per member, all `not_submitted`.
- [ ] Confirm the fan-out is transactional: simulate a failure mid-insert (or review the code path) and confirm no partial fan-out (e.g. 2 of 3 rows) is possible.

### 6. Submissions (Student, two-step)
- [ ] Call `/submissions/:id/submit` — confirm status moves to `pending_confirmation`, `submitted_at` set.
- [ ] Call `/submit` again on the same row — confirm 409 (already past step 1).
- [ ] Call `/confirm` — confirm status moves to `confirmed`, `confirmed_at` set.
- [ ] Attempt `/confirm` on a row still at `not_submitted` (skipping step 1) — confirm 409, two-step order enforced server-side.
- [ ] Attempt to submit/confirm another student's submission row — confirm 403 (ownership check).

### 7. Reports / Dashboards
- [ ] `/reports?groupId=` returns correct completion rate matching manually-counted `confirmed` rows for that group.
- [ ] `/reports/dashboard` (educator) totals match manual counts across all assignments/students.
- [ ] Progress bar in UI visually reflects the same numbers returned by the API (spot-check, not pixel-perfect).

## UI State Verification
For each async action (login, register, create assignment, upload, submit, confirm, add member): manually trigger and confirm the correct UI state renders — `processing` during the request, `success` or `error` after, with the right message for validation failures (400) vs auth failures (401/403) vs conflicts (409).
