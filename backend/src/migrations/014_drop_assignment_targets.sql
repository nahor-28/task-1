-- Targeting is now implicit via course_enrollments (individual) or
-- groups/group_members (group) — see docs/schema.md. CASCADE drops the
-- old group_progress view, which is rebuilt in a later migration.
DROP TABLE assignment_targets CASCADE;
