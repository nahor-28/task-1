CREATE VIEW group_progress AS
SELECT
  g.assignment_id,
  g.id AS group_id,
  COUNT(s.*) FILTER (WHERE s.status = 'graded')::float / NULLIF(COUNT(s.*), 0) AS completion_rate
FROM groups g
JOIN submissions s ON s.group_id = g.id
GROUP BY g.assignment_id, g.id;
