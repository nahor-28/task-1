ALTER TABLE submissions
  ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  ADD COLUMN graded_at TIMESTAMPTZ,
  DROP CONSTRAINT submissions_status_check;

ALTER TABLE submissions
  ADD CONSTRAINT submissions_status_check
    CHECK (status IN ('not_submitted', 'pending_confirmation', 'waiting_for_grading', 'graded'));
