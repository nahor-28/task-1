import { pool } from '../db/pool.js';

export async function listForAssignment(assignmentId, requesterId) {
  const { rows: assignmentRows } = await pool.query(
    'SELECT created_by FROM assignments WHERE id = $1',
    [assignmentId],
  );
  const assignment = assignmentRows[0];
  if (!assignment) return { error: 'ASSIGNMENT_NOT_FOUND' };
  if (assignment.created_by !== requesterId) return { error: 'FORBIDDEN' };

  const { rows } = await pool.query(
    `SELECT student_id, status, submitted_at, confirmed_at
     FROM submissions WHERE assignment_id = $1 ORDER BY student_id`,
    [assignmentId],
  );
  return { submissions: rows };
}

export async function getMine(assignmentId, studentId) {
  const { rows } = await pool.query(
    `SELECT status, submitted_at, confirmed_at
     FROM submissions WHERE assignment_id = $1 AND student_id = $2`,
    [assignmentId, studentId],
  );
  if (!rows[0]) return { error: 'SUBMISSION_NOT_FOUND' };
  return { submission: rows[0] };
}

async function getOwnedSubmission(id, studentId) {
  const { rows } = await pool.query('SELECT id, student_id, status FROM submissions WHERE id = $1', [id]);
  const existing = rows[0];
  if (!existing) return { error: 'SUBMISSION_NOT_FOUND' };
  if (existing.student_id !== studentId) return { error: 'FORBIDDEN' };
  return { submission: existing };
}

export async function submit(id, studentId) {
  const owned = await getOwnedSubmission(id, studentId);
  if (owned.error) return owned;
  if (owned.submission.status !== 'not_submitted') return { error: 'INVALID_STATE' };

  const { rows } = await pool.query(
    `UPDATE submissions SET status = 'pending_confirmation', submitted_at = now()
     WHERE id = $1 RETURNING status`,
    [id],
  );
  return { status: rows[0].status };
}

export async function confirm(id, studentId) {
  const owned = await getOwnedSubmission(id, studentId);
  if (owned.error) return owned;
  if (owned.submission.status !== 'pending_confirmation') return { error: 'INVALID_STATE' };

  const { rows } = await pool.query(
    `UPDATE submissions SET status = 'confirmed', confirmed_at = now()
     WHERE id = $1 RETURNING status`,
    [id],
  );
  return { status: rows[0].status };
}
