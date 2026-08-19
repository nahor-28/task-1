import { registerUser, verifyEmail } from '../services/authService.js';

const PG_UNIQUE_VIOLATION = '23505';

export async function register(req, res, next) {
  try {
    const { userId } = await registerUser(req.body);
    res.status(201).json({ userId });
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      return res.status(409).json({
        error: { message: 'Email already registered', code: 'EMAIL_IN_USE' },
      });
    }
    next(err);
  }
}

export async function verify(req, res, next) {
  try {
    const { verified } = await verifyEmail(req.query.token);
    if (!verified) {
      return res.status(400).json({
        error: { message: 'Invalid or expired verification token', code: 'INVALID_TOKEN' },
      });
    }
    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
}
