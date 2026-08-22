import { pool } from '../db/pool.js';

const COURSE_COLUMNS = 'id, title, description, created_by, active, created_at';

function mapCourse(row) {
  if (!row) return row;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdBy: row.created_by,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function createCourse({ title, description, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO courses (title, description, created_by) VALUES ($1, $2, $3) RETURNING id`,
    [title, description ?? null, createdBy],
  );
  return { courseId: rows[0].id };
}

export async function listMine(user) {
  if (user.role === 'student') {
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.description, c.created_by, c.active, c.created_at
       FROM courses c JOIN course_enrollments ce ON ce.course_id = c.id
       WHERE ce.student_id = $1 ORDER BY ce.enrolled_at DESC`,
      [user.id],
    );
    return rows.map(mapCourse);
  }

  const { rows } = await pool.query(
    `SELECT ${COURSE_COLUMNS} FROM courses WHERE created_by = $1 ORDER BY created_at DESC`,
    [user.id],
  );
  return rows.map(mapCourse);
}

export async function listActive() {
  const { rows } = await pool.query(
    `SELECT ${COURSE_COLUMNS} FROM courses WHERE active = true ORDER BY created_at DESC`,
  );
  return rows.map(mapCourse);
}

async function getCourse(id) {
  const { rows } = await pool.query(`SELECT ${COURSE_COLUMNS} FROM courses WHERE id = $1`, [id]);
  return mapCourse(rows[0]);
}

async function getOwnedCourse(id, requesterId) {
  const existing = await getCourse(id);
  if (!existing) return { error: 'NOT_FOUND' };
  if (existing.createdBy !== requesterId) return { error: 'FORBIDDEN' };
  return { course: existing };
}

async function isEnrolled(courseId, studentId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2',
    [courseId, studentId],
  );
  return rows.length > 0;
}

export async function getCourseDetail(id, user) {
  const course = await getCourse(id);
  if (!course) return { error: 'NOT_FOUND' };

  if (user.role === 'student' && !(await isEnrolled(id, user.id))) {
    return { error: 'NOT_ENROLLED' };
  }

  const [{ rows: roster }, { rows: assignments }] = await Promise.all([
    pool.query(
      `SELECT u.id, u.name, u.email
       FROM course_enrollments ce JOIN users u ON u.id = ce.student_id
       WHERE ce.course_id = $1 ORDER BY u.name`,
      [id],
    ),
    pool.query(
      `SELECT id, title, type, status, due_date AS "dueDate"
       FROM assignments WHERE course_id = $1 ORDER BY created_at DESC`,
      [id],
    ),
  ]);

  return { course: { ...course, roster, assignments } };
}

export async function enrollStudent(courseId, studentId) {
  const course = await getCourse(courseId);
  if (!course) return { error: 'NOT_FOUND' };
  if (!course.active) return { error: 'COURSE_INACTIVE' };
  if (await isEnrolled(courseId, studentId)) return { error: 'ALREADY_ENROLLED' };

  await pool.query('INSERT INTO course_enrollments (course_id, student_id) VALUES ($1, $2)', [
    courseId,
    studentId,
  ]);
  return { success: true };
}

const UPDATABLE_COLUMNS = {
  title: 'title',
  description: 'description',
  active: 'active',
};

export async function updateCourse(id, requesterId, updates) {
  const owned = await getOwnedCourse(id, requesterId);
  if (owned.error) return owned;

  const columns = Object.keys(updates).filter((key) => key in UPDATABLE_COLUMNS);
  if (columns.length === 0) {
    return { course: owned.course };
  }

  const setClause = columns.map((key, i) => `${UPDATABLE_COLUMNS[key]} = $${i + 2}`).join(', ');
  const values = columns.map((key) => updates[key]);

  const { rows } = await pool.query(
    `UPDATE courses SET ${setClause} WHERE id = $1 RETURNING ${COURSE_COLUMNS}`,
    [id, ...values],
  );
  return { course: mapCourse(rows[0]) };
}
