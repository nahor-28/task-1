import { pool } from '../db/pool.js';

export async function createAssignment({ title, description, dueDate, onedriveLink, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO assignments (title, description, due_date, onedrive_link, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [title, description, dueDate, onedriveLink, createdBy],
  );
  return { assignmentId: rows[0].id };
}

export async function listAssignments(user) {
  // Students see nothing until assignment targeting exists (Phase 5) - no
  // way yet to know which assignments are targeted at them.
  if (user.role === 'student') {
    return [];
  }

  const { rows } = await pool.query(
    `SELECT id, title, description, due_date, onedrive_link, attachment_url, created_by, created_at
     FROM assignments WHERE created_by = $1 ORDER BY created_at DESC`,
    [user.id],
  );
  return rows;
}

export async function getAssignment(id) {
  const { rows } = await pool.query(
    `SELECT id, title, description, due_date, onedrive_link, attachment_url, created_by, created_at
     FROM assignments WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

const UPDATABLE_COLUMNS = {
  title: 'title',
  description: 'description',
  dueDate: 'due_date',
  onedriveLink: 'onedrive_link',
};

export async function updateAssignment(id, requesterId, updates) {
  const existing = await getAssignment(id);
  if (!existing) {
    return { error: 'NOT_FOUND' };
  }
  if (existing.created_by !== requesterId) {
    return { error: 'FORBIDDEN' };
  }

  const columns = Object.keys(updates).filter((key) => key in UPDATABLE_COLUMNS);
  if (columns.length === 0) {
    return { assignment: existing };
  }

  const setClause = columns.map((key, i) => `${UPDATABLE_COLUMNS[key]} = $${i + 2}`).join(', ');
  const values = columns.map((key) => updates[key]);

  const { rows } = await pool.query(
    `UPDATE assignments SET ${setClause} WHERE id = $1
     RETURNING id, title, description, due_date, onedrive_link, attachment_url, created_by, created_at`,
    [id, ...values],
  );
  return { assignment: rows[0] };
}
