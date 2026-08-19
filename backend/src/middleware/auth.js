import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: { message: 'Missing or invalid Authorization header', code: 'UNAUTHENTICATED' },
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.purpose) {
      throw new Error('Not an access token');
    }
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch {
    return res.status(401).json({
      error: { message: 'Invalid or expired token', code: 'UNAUTHENTICATED' },
    });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
    }
    next();
  };
}
