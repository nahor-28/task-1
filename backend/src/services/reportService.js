import { pool } from '../db/pool.js';

async function studentAssignments(studentId) {
  const { rows } = await pool.query(
    `SELECT a.id, a.title, a.course_id AS "courseId", s.status
     FROM submissions s JOIN assignments a ON a.id = s.assignment_id
     WHERE s.student_id = $1
     ORDER BY a.due_date`,
    [studentId],
  );
  const graded = rows.filter((r) => r.status === 'graded').length;
  const completionRate = rows.length === 0 ? 0 : graded / rows.length;
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
  let totalGraded = 0;
  let totalSubmissions = 0;
  for (const member of memberRows) {
    const { assignments, completionRate } = await studentAssignments(member.id);
    members.push({ studentId: member.id, name: member.name, completionRate, assignments });
    totalGraded += assignments.filter((a) => a.status === 'graded').length;
    totalSubmissions += assignments.length;
  }
  const completionRate = totalSubmissions === 0 ? 0 : totalGraded / totalSubmissions;

  return { report: { members, completionRate } };
}

async function educatorDashboard(educatorId) {
  const { rows: courses } = await pool.query(
    'SELECT id, title, active FROM courses WHERE created_by = $1 ORDER BY created_at DESC',
    [educatorId],
  );

  const { rows: assignments } = await pool.query(
    `SELECT a.id, a.title, a.course_id AS "courseId", a.status AS "assignmentStatus",
            COUNT(*) FILTER (WHERE s.status = 'not_submitted')::int AS "notSubmitted",
            COUNT(*) FILTER (WHERE s.status = 'pending_confirmation')::int AS "pendingConfirmation",
            COUNT(*) FILTER (WHERE s.status = 'waiting_for_grading')::int AS "waitingForGrading",
            COUNT(*) FILTER (WHERE s.status = 'graded')::int AS graded
     FROM assignments a LEFT JOIN submissions s ON s.assignment_id = a.id
     WHERE a.created_by = $1
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
    [educatorId],
  );

  return { courses, assignments };
}

async function studentDashboard(studentId) {
  const { rows: courses } = await pool.query(
    `SELECT c.id, c.title
     FROM courses c JOIN course_enrollments ce ON ce.course_id = c.id
     WHERE ce.student_id = $1 ORDER BY ce.enrolled_at DESC`,
    [studentId],
  );

  const { assignments, completionRate } = await studentAssignments(studentId);

  return { courses, assignments, completionRate };
}

export async function getDashboard(user) {
  return user.role === 'student' ? studentDashboard(user.id) : educatorDashboard(user.id);
}
