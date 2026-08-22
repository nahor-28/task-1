import { pool } from '../db/pool.js';

async function getGroupAssignment(assignmentId) {
  const { rows } = await pool.query(
    'SELECT type, status, course_id, created_by FROM assignments WHERE id = $1',
    [assignmentId],
  );
  return rows[0] ?? null;
}

async function isEnrolled(courseId, studentId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2',
    [courseId, studentId],
  );
  return rows.length > 0;
}

async function checkAccess(assignment, user) {
  if (user.role === 'educator') {
    return assignment.created_by === user.id ? null : { error: 'FORBIDDEN' };
  }
  return (await isEnrolled(assignment.course_id, user.id)) ? null : { error: 'FORBIDDEN' };
}

export async function listOpenGroups(assignmentId, user) {
  const assignment = await getGroupAssignment(assignmentId);
  if (!assignment || assignment.type !== 'group' || assignment.status !== 'published') {
    return { error: 'ASSIGNMENT_NOT_FOUND' };
  }

  const accessError = await checkAccess(assignment, user);
  if (accessError) return accessError;

  const { rows: groups } = await pool.query(
    'SELECT id, name, created_at FROM groups WHERE assignment_id = $1 ORDER BY name',
    [assignmentId],
  );

  const withMembers = await Promise.all(
    groups.map(async (g) => {
      const { rows: members } = await pool.query(
        `SELECT u.id, u.name, u.email, gm.role
         FROM group_members gm JOIN users u ON u.id = gm.student_id
         WHERE gm.group_id = $1 ORDER BY gm.joined_at`,
        [g.id],
      );
      return { id: g.id, name: g.name, createdAt: g.created_at, members };
    }),
  );

  return { groups: withMembers };
}

export async function joinGroup(assignmentId, groupId, studentId) {
  const assignment = await getGroupAssignment(assignmentId);
  if (!assignment || assignment.type !== 'group' || assignment.status !== 'published') {
    return { error: 'ASSIGNMENT_NOT_FOUND' };
  }

  if (!(await isEnrolled(assignment.course_id, studentId))) {
    return { error: 'FORBIDDEN' };
  }

  const { rows: groupRows } = await pool.query(
    'SELECT id FROM groups WHERE id = $1 AND assignment_id = $2',
    [groupId, assignmentId],
  );
  if (!groupRows[0]) return { error: 'GROUP_NOT_FOUND' };

  const { rows: existing } = await pool.query(
    `SELECT 1 FROM group_members gm JOIN groups g ON g.id = gm.group_id
     WHERE g.assignment_id = $1 AND gm.student_id = $2`,
    [assignmentId, studentId],
  );
  if (existing.length > 0) return { error: 'ALREADY_IN_GROUP' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO group_members (group_id, student_id) VALUES ($1, $2)', [
      groupId,
      studentId,
    ]);
    await client.query(
      'INSERT INTO submissions (assignment_id, student_id, group_id) VALUES ($1, $2, $3)',
      [assignmentId, studentId, groupId],
    );
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
