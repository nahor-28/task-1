import { rateLimit } from 'express-rate-limit';

function tooManyRequests(req, res) {
  res.status(429).json({
    error: { message: 'Too many requests, please try again in a minute', code: 'RATE_LIMITED' },
  });
}

export function strictLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: tooManyRequests,
  });
}
