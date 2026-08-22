-- Course-centric refactor changes group/assignment/submission shape in ways
-- existing dev rows can't satisfy (e.g. groups.assignment_id NOT NULL).
-- Dev-only reset, per project convention: no production data exists yet.
TRUNCATE TABLE assignment_targets, submissions, group_members, groups, assignments RESTART IDENTITY CASCADE;
