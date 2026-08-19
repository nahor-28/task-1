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
