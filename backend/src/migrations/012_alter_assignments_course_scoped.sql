ALTER TABLE assignments
  ADD COLUMN course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  ADD COLUMN type TEXT NOT NULL CHECK (type IN ('individual', 'group')),
  ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  ADD COLUMN num_groups INTEGER,
  ADD COLUMN published_at TIMESTAMPTZ,
  ADD CONSTRAINT assignments_group_requires_num_groups CHECK (type != 'group' OR num_groups IS NOT NULL);
