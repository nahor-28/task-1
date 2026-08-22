import { pool } from '../db/pool.js';

const ASSIGNMENT_COLUMNS =
  'id, course_id, title, description, type, status, num_groups, due_date, onedrive_link, attachment_url, created_by, published_at, created_at';

function mapAssignment(row) {
  if (!row) return row;
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    numGroups: row.num_groups,
    dueDate: row.due_date,
    onedriveLink: row.onedrive_link,
    attachmentUrl: row.attachment_url,
    createdBy: row.created_by,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export async function createAssignment({
  courseId,
  title,
  description,
  dueDate,
  onedriveLink,
  type,
  numGroups,
  createdBy,
}) {
  const { rows: courseRows } = await pool.query('SELECT created_by FROM courses WHERE id = $1', [courseId]);
  if (!courseRows[0]) return { error: 'COURSE_NOT_FOUND' };
  if (courseRows[0].created_by !== createdBy) return { error: 'COURSE_FORBIDDEN' };

  const { rows } = await pool.query(
    `INSERT INTO assignments (course_id, title, description, due_date, onedrive_link, type, num_groups, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [courseId, title, description, dueDate, onedriveLink ?? null, type, numGroups ?? null, createdBy],
  );
  return { assignmentId: rows[0].id };
}

export async function listAssignments(user) {
  if (user.role === 'student') {
    const { rows } = await pool.query(
      `SELECT a.id, a.course_id, a.title, a.description, a.type, a.status, a.num_groups,
              a.due_date, a.onedrive_link, a.attachment_url, a.created_by, a.published_at, a.created_at
       FROM assignments a JOIN course_enrollments ce ON ce.course_id = a.course_id
       WHERE ce.student_id = $1 AND a.status = 'published'
       ORDER BY a.published_at DESC`,
      [user.id],
    );
    return rows.map(mapAssignment);
  }

  const { rows } = await pool.query(
    `SELECT ${ASSIGNMENT_COLUMNS} FROM assignments WHERE created_by = $1 ORDER BY created_at DESC`,
    [user.id],
  );
  return rows.map(mapAssignment);
}

async function getAssignment(id) {
  const { rows } = await pool.query(`SELECT ${ASSIGNMENT_COLUMNS} FROM assignments WHERE id = $1`, [id]);
  return mapAssignment(rows[0]);
}

async function isEnrolled(courseId, studentId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2',
    [courseId, studentId],
  );
  return rows.length > 0;
}

export async function getAssignmentDetail(id, user) {
  const assignment = await getAssignment(id);
  if (!assignment) return { error: 'NOT_FOUND' };

  if (user.role === 'educator') {
    if (assignment.createdBy !== user.id) return { error: 'FORBIDDEN' };
    return { assignment };
  }

  // Drafts aren't visible to students at all - treat as not found, not forbidden.
  if (assignment.status !== 'published') return { error: 'NOT_FOUND' };
  if (!(await isEnrolled(assignment.courseId, user.id))) return { error: 'FORBIDDEN' };
  return { assignment };
}

async function getOwnedAssignment(id, requesterId) {
  const existing = await getAssignment(id);
  if (!existing) return { error: 'NOT_FOUND' };
  if (existing.createdBy !== requesterId) return { error: 'FORBIDDEN' };
  return { assignment: existing };
}

const CONTENT_COLUMNS = { title: 'title', description: 'description', dueDate: 'due_date', onedriveLink: 'onedrive_link' };
const DRAFT_ONLY_COLUMNS = { type: 'type', numGroups: 'num_groups' };

export async function updateAssignment(id, requesterId, updates) {
  const owned = await getOwnedAssignment(id, requesterId);
  if (owned.error) return owned;

  const allowedColumns = owned.assignment.status === 'draft' ? { ...CONTENT_COLUMNS, ...DRAFT_ONLY_COLUMNS } : CONTENT_COLUMNS;
  const columns = Object.keys(updates).filter((key) => key in allowedColumns);
  if (columns.length === 0) {
    return { assignment: owned.assignment };
  }

  const setClause = columns.map((key, i) => `${allowedColumns[key]} = $${i + 2}`).join(', ');
  const values = columns.map((key) => updates[key]);

  const { rows } = await pool.query(
    `UPDATE assignments SET ${setClause} WHERE id = $1 RETURNING ${ASSIGNMENT_COLUMNS}`,
    [id, ...values],
  );
  return { assignment: mapAssignment(rows[0]) };
}

export async function deleteAssignment(id, requesterId) {
  const owned = await getOwnedAssignment(id, requesterId);
  if (owned.error) return owned;

  const { rows } = await pool.query('SELECT 1 FROM submissions WHERE assignment_id = $1 LIMIT 1', [id]);
  if (rows.length > 0) {
    return { error: 'HAS_SUBMISSIONS' };
  }

  await pool.query('DELETE FROM assignments WHERE id = $1', [id]);
  return { success: true };
}

export async function setAttachment(id, requesterId, attachmentUrl) {
  const owned = await getOwnedAssignment(id, requesterId);
  if (owned.error) return owned;

  await pool.query('UPDATE assignments SET attachment_url = $1 WHERE id = $2', [attachmentUrl, id]);
  return { attachmentUrl };
}

export async function publishAssignment(id, requesterId) {
  const owned = await getOwnedAssignment(id, requesterId);
  if (owned.error) return owned;
  const assignment = owned.assignment;
  if (assignment.status === 'published') return { error: 'ALREADY_PUBLISHED' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (assignment.type === 'individual') {
      await client.query(
        `INSERT INTO submissions (assignment_id, student_id)
         SELECT $1, student_id FROM course_enrollments WHERE course_id = $2`,
        [id, assignment.courseId],
      );
    } else {
      const { rows: leaders } = await client.query(
        `SELECT student_id FROM course_enrollments WHERE course_id = $1 ORDER BY random() LIMIT $2`,
        [assignment.courseId, assignment.numGroups],
      );
      if (leaders.length < assignment.numGroups) {
        await client.query('ROLLBACK');
        return { error: 'NOT_ENOUGH_STUDENTS' };
      }

      for (const [i, leader] of leaders.entries()) {
        const { rows: group } = await client.query(
          'INSERT INTO groups (assignment_id, name) VALUES ($1, $2) RETURNING id',
          [id, `Group ${i + 1}`],
        );
        const groupId = group[0].id;
        await client.query(
          `INSERT INTO group_members (group_id, student_id, role) VALUES ($1, $2, 'leader')`,
          [groupId, leader.student_id],
        );
        await client.query(
          'INSERT INTO submissions (assignment_id, student_id, group_id) VALUES ($1, $2, $3)',
          [id, leader.student_id, groupId],
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE assignments SET status = 'published', published_at = now() WHERE id = $1 RETURNING ${ASSIGNMENT_COLUMNS}`,
      [id],
    );
    await client.query('COMMIT');
    return { assignment: mapAssignment(rows[0]) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
