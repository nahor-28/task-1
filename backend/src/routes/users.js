import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { me, search, list } from '../controllers/userController.js';

const router = Router();

const searchSchema = z.object({
  email: z.email(),
});

const listSchema = z.object({
  role: z.enum(['student', 'educator']),
});

router.get('/me', requireAuth, me);
router.get('/search', requireAuth, validateQuery(searchSchema), search);
router.get('/', requireAuth, validateQuery(listSchema), list);

export default router;
