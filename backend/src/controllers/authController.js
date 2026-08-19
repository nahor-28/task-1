import { registerUser } from '../services/authService.js';

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
