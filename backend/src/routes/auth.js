import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { register } from '../controllers/authController.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(['student']),
});

router.post('/register', validate(registerSchema), register);

export default router;
