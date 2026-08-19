import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';

const BCRYPT_COST = 10;

export async function registerUser({ name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, email, passwordHash, role],
  );

  return { userId: rows[0].id };
}
