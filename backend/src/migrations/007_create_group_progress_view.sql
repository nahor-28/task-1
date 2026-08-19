CREATE VIEW group_progress AS
SELECT
  at.group_id,
  a.id AS assignment_id,
  COUNT(s.*) FILTER (WHERE s.status = 'confirmed')::float / NULLIF(COUNT(s.*), 0) AS completion_rate
FROM assignment_targets at
JOIN assignments a ON a.id = at.assignment_id
JOIN group_members gm ON gm.group_id = at.group_id
JOIN submissions s ON s.assignment_id = a.id AND s.student_id = gm.student_id
WHERE at.group_id IS NOT NULL
GROUP BY at.group_id, a.id;
