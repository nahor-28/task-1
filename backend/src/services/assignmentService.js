import { pool } from '../db/pool.js';

const ASSIGNMENT_COLUMNS = 'id, title, description, due_date, onedrive_link, attachment_url, created_by, created_at';

function mapAssignment(row) {
  if (!row) return row;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    onedriveLink: row.onedrive_link,
    attachmentUrl: row.attachment_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function createAssignment({ title, description, dueDate, onedriveLink, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO assignments (title, description, due_date, onedrive_link, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [title, description, dueDate, onedriveLink ?? null, createdBy],
  );
  return { assignmentId: rows[0].id };
}

export async function listAssignments(user) {
  if (user.role === 'student') {
    const { rows } = await pool.query(
      `SELECT DISTINCT a.id, a.title, a.description, a.due_date, a.onedrive_link, a.attachment_url, a.created_by, a.created_at
       FROM assignments a
       JOIN assignment_targets at ON at.assignment_id = a.id
       LEFT JOIN group_members gm ON gm.group_id = at.group_id AND gm.student_id = $1
       WHERE at.student_id = $1 OR gm.student_id = $1
       ORDER BY a.created_at DESC`,
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

export async function getAssignment(id) {
  const { rows } = await pool.query(
    `SELECT ${ASSIGNMENT_COLUMNS} FROM assignments WHERE id = $1`,
    [id],
  );
  return mapAssignment(rows[0]);
}

async function getOwnedAssignment(id, requesterId) {
  const existing = await getAssignment(id);
  if (!existing) {
    return { error: 'NOT_FOUND' };
  }
  if (existing.createdBy !== requesterId) {
    return { error: 'FORBIDDEN' };
  }
  return { assignment: existing };
}

const UPDATABLE_COLUMNS = {
  title: 'title',
  description: 'description',
  dueDate: 'due_date',
  onedriveLink: 'onedrive_link',
};

export async function updateAssignment(id, requesterId, updates) {
  const owned = await getOwnedAssignment(id, requesterId);
  if (owned.error) return owned;

  const columns = Object.keys(updates).filter((key) => key in UPDATABLE_COLUMNS);
  if (columns.length === 0) {
    return { assignment: owned.assignment };
  }

  const setClause = columns.map((key, i) => `${UPDATABLE_COLUMNS[key]} = $${i + 2}`).join(', ');
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

  const { rows } = await pool.query(
    'SELECT 1 FROM submissions WHERE assignment_id = $1 LIMIT 1',
    [id],
  );
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

export async function assignTarget(assignmentId, requesterId, { targetType, targetId }) {
  const owned = await getOwnedAssignment(assignmentId, requesterId);
  if (owned.error) return owned;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (targetType === 'student') {
      const { rows } = await client.query('SELECT role FROM users WHERE id = $1', [targetId]);
      if (!rows[0] || rows[0].role !== 'student') {
        await client.query('ROLLBACK');
        return { error: 'STUDENT_NOT_FOUND' };
      }

      const { rows: target } = await client.query(
        'INSERT INTO assignment_targets (assignment_id, student_id) VALUES ($1, $2) RETURNING id',
        [assignmentId, targetId],
      );
      await client.query(
        'INSERT INTO submissions (assignment_id, student_id) VALUES ($1, $2)',
        [assignmentId, targetId],
      );
      await client.query('COMMIT');
      return { targetId: target[0].id };
    }

    const { rows: group } = await client.query('SELECT id FROM groups WHERE id = $1', [targetId]);
    if (!group[0]) {
      await client.query('ROLLBACK');
      return { error: 'GROUP_NOT_FOUND' };
    }

    const { rows: target } = await client.query(
      'INSERT INTO assignment_targets (assignment_id, group_id) VALUES ($1, $2) RETURNING id',
      [assignmentId, targetId],
    );
    await client.query(
      `INSERT INTO submissions (assignment_id, student_id)
       SELECT $1, student_id FROM group_members WHERE group_id = $2`,
      [assignmentId, targetId],
    );
    await client.query('COMMIT');
    return { targetId: target[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
