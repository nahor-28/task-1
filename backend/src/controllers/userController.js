import { pool } from '../db/pool.js';

export async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.user.id],
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function search(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [req.query.email],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email FROM users WHERE role = $1 ORDER BY name',
      [req.query.role],
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
