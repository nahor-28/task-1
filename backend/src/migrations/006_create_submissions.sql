CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_submitted', 'pending_confirmation', 'confirmed')) DEFAULT 'not_submitted',
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  UNIQUE (assignment_id, student_id)
);
