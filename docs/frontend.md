# Frontend

Implementation detail one level below `architecture.md` — this doc covers frontend-specific structure only; system-level diagram and folder layout live in `architecture.md`, not repeated here.

## Route Guarding
Public routes: `/login`, `/register`, `/verify` (email verification landing page). Every other route requires a valid JWT.
- No token / expired token → redirect to `/login`.
- Valid token but wrong role for the route (e.g. student hitting an educator route) → redirect to that role's own dashboard, not an error page.
- Root path `/` → redirect to `/login` if unauthenticated, or to the role-appropriate dashboard if authenticated. There is no public landing/marketing page.

## Route Map

### Student
| Route | Purpose |
|---|---|
| `/dashboard` | Assigned work, groupmates, progress overview — per brief's student deliverables |
| `/assignments` | All assignments visible to this student (individually or via group) |
| `/assignments/:id` | Assignment detail — description, due date, OneDrive link, attachment viewer, submission status, "Yes, I have submitted" trigger |
| `/groups` | Student's group(s) — members list, add-member (if leader), leave/remove |
| `/groups/new` | Create group |

### Educator
| Route | Purpose |
|---|---|
| `/dashboard` | Analytics overview — completion rates, summary counts, per brief's admin deliverables |
| `/assignments` | List of assignments created by this educator |
| `/assignments/new` | Create assignment (title, description, due date, OneDrive link, attachment upload) |
| `/assignments/:id` | Assignment detail — edit, delete (if no submissions exist), assign to student/group, per-target submission status |
| `/assignments/:id/report` | Group-wise and student-wise submission tracking for this assignment |

### Shared (role-agnostic)
| Route | Purpose |
|---|---|
| `/login` | Public |
| `/register` | Public |
| `/verify` | Public, landing page for Brevo email verification link |

## Component Inventory

Shared, reusable — build once, reuse across both roles:

- **ProgressBar** — takes a completion rate (0–1), renders bar or badge form. Used on student dashboard (own group progress) and educator dashboard/report (per-group, per-student).
- **StatusToast** — the five UI states required by the brief: `idle`, `processing`, `success`, `error`, `warning`/`info`. One component, triggered centrally from the fetch wrapper on request lifecycle, not reimplemented per page.
- **ConfirmModal** — generic confirm/cancel modal, reused for the two-step submission flow (see below) and any other destructive action (e.g. group delete, assignment delete).
- **StatusBadge** — small inline indicator for `not_submitted` / `pending_confirmation` / `confirmed`, used in lists (assignment list, group member list, report tables).

## Two-Step Submission Flow (specific interaction)

"Yes, I have submitted" is a button on the assignment detail page. Clicking it opens `ConfirmModal`, not an inline second button — because confirmation is irreversible (`confirmed` status cannot be changed back), the modal exists specifically to force the student to pause and verify they've actually uploaded their work externally before locking it in. Modal copy should say this explicitly (e.g. "Check your OneDrive upload before confirming — this cannot be undone"). Modal's confirm action calls `PATCH /submissions/:id/confirm`; cancel closes the modal with no API call, leaving status at `pending_confirmation` (already set by the initial button click, which calls `PATCH /submissions/:id/submit`).

## State Management
React Context API — no Redux/Zustand. App scale doesn't justify the extra dependency. One `AuthContext` holding `{ user, role, token, login(), logout() }`, provided at the app root, consumed via a `useAuth()` hook. No other global state is needed — assignment/group/submission data is fetched per-page and held in local component state, not globally cached, since there's no cross-page data-sharing requirement complex enough to justify it.

## API Client
One centralized fetch wrapper (`api/client.js` or similar), not per-component fetch calls:
- Attaches `Authorization: Bearer <token>` from `AuthContext` to every request automatically.
- On `401` response: clears auth context, redirects to `/login` — centralized, not handled per-page.
- On `403`/`404`/`409`: returns the error to the caller for page-specific handling (e.g. 409 on delete-with-submissions shows a specific "archive instead" message).
- Drives `StatusToast` state transitions (`processing` on request start, `success`/`error` on resolution) so every page gets consistent UI feedback without reimplementing it.

## Dashboard Content (per brief, no restatement needed beyond mapping to components)
- **Student dashboard:** assigned projects list, groupmates (if any), teacher/educator names, progress via `ProgressBar`/`StatusBadge`.
- **Educator dashboard:** assignment list, group-wise and student-wise submission confirmation tracking, analytics — basic charts or summary counts (completion rate, total confirmed vs pending) via `ProgressBar` and simple count displays, not a charting library unless time permits.
