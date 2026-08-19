import { pool } from '../db/pool.js';

async function studentAssignments(studentId) {
  const { rows } = await pool.query(
    `SELECT a.id, a.title, s.status
     FROM submissions s JOIN assignments a ON a.id = s.assignment_id
     WHERE s.student_id = $1
     ORDER BY a.created_at DESC`,
    [studentId],
  );
  const confirmed = rows.filter((r) => r.status === 'confirmed').length;
  const completionRate = rows.length === 0 ? 0 : confirmed / rows.length;
  return { assignments: rows, completionRate };
}

export async function getStudentReport(studentId, requester) {
  if (requester.role === 'student' && requester.id !== studentId) {
    return { error: 'FORBIDDEN' };
  }
  return { report: await studentAssignments(studentId) };
}

export async function getGroupReport(groupId, requester) {
  const { rows: groupRows } = await pool.query('SELECT id FROM groups WHERE id = $1', [groupId]);
  if (!groupRows[0]) return { error: 'NOT_FOUND' };

  if (requester.role === 'student') {
    const { rows: membership } = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2',
      [groupId, requester.id],
    );
    if (!membership[0]) return { error: 'FORBIDDEN' };
  }

  const { rows: memberRows } = await pool.query(
    `SELECT u.id, u.name FROM group_members gm JOIN users u ON u.id = gm.student_id
     WHERE gm.group_id = $1 ORDER BY gm.joined_at`,
    [groupId],
  );

  const members = [];
  let totalConfirmed = 0;
  let totalSubmissions = 0;
  for (const member of memberRows) {
    const { assignments, completionRate } = await studentAssignments(member.id);
    members.push({ studentId: member.id, name: member.name, completionRate, assignments });
    totalConfirmed += assignments.filter((a) => a.status === 'confirmed').length;
    totalSubmissions += assignments.length;
  }
  const completionRate = totalSubmissions === 0 ? 0 : totalConfirmed / totalSubmissions;

  return { report: { members, completionRate } };
}

export async function getDashboard(educatorId) {
  const { rows: assignmentCount } = await pool.query(
    'SELECT count(*)::int AS total FROM assignments WHERE created_by = $1',
    [educatorId],
  );

  const { rows: stats } = await pool.query(
    `SELECT
       count(DISTINCT s.student_id)::int AS total_students,
       COALESCE(COUNT(*) FILTER (WHERE s.status = 'confirmed')::float / NULLIF(COUNT(*), 0), 0) AS avg_completion_rate
     FROM submissions s JOIN assignments a ON a.id = s.assignment_id
     WHERE a.created_by = $1`,
    [educatorId],
  );

  const { rows: groupSummaries } = await pool.query(
    `SELECT g.id, g.name, AVG(gp.completion_rate) AS completion_rate
     FROM group_progress gp
     JOIN groups g ON g.id = gp.group_id
     JOIN assignments a ON a.id = gp.assignment_id
     WHERE a.created_by = $1
     GROUP BY g.id, g.name
     ORDER BY g.name`,
    [educatorId],
  );

  return {
    totalAssignments: assignmentCount[0].total,
    totalStudents: stats[0].total_students,
    avgCompletionRate: stats[0].avg_completion_rate,
    groupSummaries: groupSummaries.map((g) => ({ id: g.id, name: g.name, completionRate: g.completion_rate })),
  };
}
