import { registerUser, verifyEmail, loginUser } from '../services/authService.js';

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

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.body);

    if (result.error === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
      });
    }
    if (result.error === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({
        error: { message: 'Please verify your email before logging in', code: 'EMAIL_NOT_VERIFIED' },
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export function logout(req, res) {
  // Client-side token discard only - no server-side revocation store.
  // Stated, accepted tradeoff for assessment scope (see docs/security.md).
  res.json({});
}
