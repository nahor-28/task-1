CREATE TABLE assignment_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id),
  group_id UUID REFERENCES groups(id),
  CHECK (
    (student_id IS NOT NULL AND group_id IS NULL) OR
    (student_id IS NULL AND group_id IS NOT NULL)
  )
);
