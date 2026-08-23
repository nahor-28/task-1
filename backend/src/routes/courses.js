import { Router } from 'express';
import { z } from 'zod';
import { validate, validateParams } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { create, mine, browse, detail, enroll, update } from '../controllers/courseController.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  active: z.boolean().optional(),
});

const idParamSchema = z.object({
  id: z.uuid(),
});

router.post('/', requireAuth, requireRole('educator'), validate(createSchema), create);
router.get('/mine', requireAuth, mine);
router.get('/', requireAuth, requireRole('student'), browse);
router.get('/:id', requireAuth, validateParams(idParamSchema), detail);
router.post('/:id/enroll', requireAuth, requireRole('student'), validateParams(idParamSchema), enroll);
router.put(
  '/:id',
  requireAuth,
  requireRole('educator'),
  validateParams(idParamSchema),
  validate(updateSchema),
  update,
);

export default router;
