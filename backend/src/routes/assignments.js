import { Router } from 'express';
import { z } from 'zod';
import { validate, validateParams } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { create, list, detail, update } from '../controllers/assignmentController.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  dueDate: z.coerce.date(),
  onedriveLink: z.url(),
});

const updateSchema = createSchema.partial();

const idParamSchema = z.object({
  id: z.uuid(),
});

router.post('/', requireAuth, requireRole('educator'), validate(createSchema), create);
router.get('/', requireAuth, list);
router.get('/:id', requireAuth, validateParams(idParamSchema), detail);
router.put(
  '/:id',
  requireAuth,
  requireRole('educator'),
  validateParams(idParamSchema),
  validate(updateSchema),
  update,
);

export default router;
