import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { confirmAll } from '../controllers/groupController.js';

const router = Router();

const idParamSchema = z.object({
  id: z.uuid(),
});

router.post('/:id/confirm-all', requireAuth, requireRole('student'), validateParams(idParamSchema), confirmAll);

export default router;
