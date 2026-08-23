ALTER TABLE groups
  ADD COLUMN assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  DROP COLUMN created_by;
