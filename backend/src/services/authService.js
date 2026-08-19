import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { sendVerificationEmail } from './emailService.js';

const BCRYPT_COST = 10;
const VERIFICATION_TOKEN_TTL = '24h';

export async function registerUser({ name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, email, passwordHash, role],
  );
  const userId = rows[0].id;

  const token = jwt.sign({ userId, purpose: 'email_verification' }, process.env.JWT_SECRET, {
    expiresIn: VERIFICATION_TOKEN_TTL,
  });

  try {
    await sendVerificationEmail(email, token);
  } catch (err) {
    console.error('Failed to send verification email:', err.message);
  }

  return { userId };
}

export async function verifyEmail(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return { verified: false };
  }

  if (payload.purpose !== 'email_verification') {
    return { verified: false };
  }

  const { rowCount } = await pool.query(
    'UPDATE users SET email_verified = true WHERE id = $1',
    [payload.userId],
  );

  return { verified: rowCount === 1 };
}
