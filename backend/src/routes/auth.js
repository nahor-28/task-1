import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { strictLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { register, verify, login, logout } from '../controllers/authController.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(['student']),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

router.post('/register', strictLimiter(), validate(registerSchema), register);
router.get('/verify', verify);
router.post('/login', strictLimiter(), validate(loginSchema), login);
router.post('/logout', requireAuth, logout);

export default router;
