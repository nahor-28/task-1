# Frontend

Implementation detail one level below `architecture.md` — this doc covers frontend-specific structure only; system-level diagram and folder layout live in `architecture.md`, not repeated here.

## Route Guarding
Public routes: `/login`, `/register`, `/verify` (email verification landing page). Every other route requires a valid JWT (`ProtectedRoute`, role-gated per route).
- No token / expired token → redirect to `/login`.
- Valid token but wrong role for the route (e.g. student hitting an educator route) → redirect to that role's own dashboard, not an error page.
- Root path `/` → redirect to `/login` if unauthenticated, or to the role-appropriate dashboard if authenticated. There is no public landing/marketing page.

## Route Map

### Student
| Route | Purpose |
|---|---|
| `/student/dashboard` | Published assignments across all enrolled courses (`GET /assignments`) |
| `/student/courses` | "My courses" list + browse active courses to self-enroll |
| `/student/courses/:id` | Course detail — roster, published assignments |
| `/student/assignments/:id` | Assignment detail — description, due date, OneDrive link, attachment viewer, submission status; group-vs-individual branching (self-confirm only for individual; group shows a link to the group page and a "waiting on your leader" note once submitted) |
| `/student/assignments/:id/groups` | Self-assembly for a group-type assignment — browse open groups, join one, and (leader only) confirm-all |
| `/student/reports` | Own assignment statuses + completion rate |

### Educator
| Route | Purpose |
|---|---|
| `/educator/dashboard` | Courses taught + per-assignment status-count breakdown |
| `/educator/courses` | List of courses taught, create-course form, active/inactive toggle |
| `/educator/courses/:id` | Course detail — roster, assignments, "new assignment" link (pre-fills `courseId`) |
| `/educator/assignments` | List of assignments created by this educator, with status |
| `/educator/assignments/new` | Create assignment — course select, title/description/due date/OneDrive link, type (individual/group) + `numGroups` when group, attachment upload. Optional `?courseId=` query param pre-selects the course. |
| `/educator/assignments/:id/edit` | Edit — same form; `type`/`numGroups` disabled once the assignment is published |
| `/educator/assignments/:id` | Assignment detail — status badge, Publish action (draft only), edit/delete, per-student submission status with a Grade action once `waiting_for_grading` |
| `/educator/reports` | Per-student drill-down report (lookup by student) |

### Shared (role-agnostic)
| Route | Purpose |
|---|---|
| `/login` | Public |
| `/register` | Public |
| `/verify` | Public, landing page for Brevo email verification link |

## Component Inventory

Shared, reusable — build once, reuse across both roles:

- **ConfirmDialog** (`components/ConfirmDialog.jsx`) + **useConfirm** hook (`hooks/useConfirm.js`) — native `<dialog>`-based confirm/cancel modal, driven by a small hook so any page can call `confirm(title, message, onConfirm)`. Reused for every create/delete/publish/confirm-all action site-wide, not reimplemented per page. Not a native browser `confirm()` — automation tooling (and anyone scripting the app) needs to click its rendered buttons, not use a dialog-accept handler.
- **ToastContext** (`context/ToastContext.jsx`) — `success`/`error` toast notifications, pushed from any page via `useToast()`, auto-dismiss after 4s. Every async action's outcome surfaces through this rather than inline per-page banners.
- **AttachmentViewer** (`components/AttachmentViewer.jsx`) — renders a download link, plus an inline PDF preview when the attachment is a PDF.
- **Layout** (`components/Layout.jsx`) — top nav (Dashboard / Courses / Assignments\* / Reports, \*educator only) + `<Outlet />`. Groups have no top-level nav entry — they're reached from an assignment's own detail page, since a group only exists in the context of one assignment.

## Two-Step Submission Flow (specific interaction)

"I confirm I have completed and submitted this assignment" is a checkbox on the assignment detail page (`PATCH /submissions/:id/submit`, status → `pending_confirmation`). For **individual** assignments only, a second "Confirm submission" button then appears, gated behind `ConfirmDialog` since confirmation is irreversible (`PATCH /submissions/:id/confirm`, status → `waiting_for_grading`). **Group** assignment submissions skip this second step entirely — the button doesn't render, and the page shows "Waiting for your group leader to confirm all submissions" instead; the leader's "Confirm all submissions" action (on the group page, also behind `ConfirmDialog`) sweeps every member's row at once.

## State Management
React Context API — no Redux/Zustand. One `AuthContext` holding `{ user, role, token, login(), logout() }`, provided at the app root, consumed via a `useAuth()` hook. One `ToastContext` for cross-page notifications. No other global state — course/assignment/group/submission data is fetched per-page and held in local component state, not globally cached.

## API Client
One centralized fetch wrapper (`api/client.js`), not per-component fetch calls:
- `api.get/post/put/patch/del(path, token)` plus `api.upload(path, formData, token)` for multipart.
- Attaches `Authorization: Bearer <token>` when a token is passed.
- Throws on a non-2xx response with the server's `error.message`, so every page's own `try/catch` around an `api.*` call handles its own error display (toast or inline banner) — there is no centralized global-401-redirect interceptor; `ProtectedRoute` handles the missing/expired-token case on navigation instead.

## Dashboard Content
- **Student dashboard** (`/student/dashboard`): published assignments due list, drawn from `GET /assignments`.
- **Student reports** (`/student/reports`): assignment-by-assignment status plus an overall completion rate, from `GET /reports?studentId=<self>`.
- **Educator dashboard** (`/educator/dashboard`): course count + assignment count summary tiles, then a per-assignment breakdown (course, lifecycle status, and a 4-way status-count line: not submitted / pending confirmation / waiting for grading / graded), from `GET /reports/dashboard`.
- **Educator reports** (`/educator/reports`): per-student drill-down lookup (select a student, see their assignment statuses + completion rate).
