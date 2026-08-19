import { Router } from 'express';
import { z } from 'zod';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { list, mine, submitHandler, confirmHandler } from '../controllers/submissionController.js';

const router = Router();

const assignmentQuerySchema = z.object({
  assignmentId: z.uuid(),
});

const idParamSchema = z.object({
  id: z.uuid(),
});

router.get('/', requireAuth, requireRole('educator'), validateQuery(assignmentQuerySchema), list);
router.get('/mine', requireAuth, requireRole('student'), validateQuery(assignmentQuerySchema), mine);
router.patch('/:id/submit', requireAuth, requireRole('student'), validateParams(idParamSchema), submitHandler);
router.patch('/:id/confirm', requireAuth, requireRole('student'), validateParams(idParamSchema), confirmHandler);

export default router;
