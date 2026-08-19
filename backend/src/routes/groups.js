import { Router } from 'express';
import { z } from 'zod';
import { validate, validateParams } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { create, detail, mine, addMemberHandler, removeMemberHandler, remove } from '../controllers/groupController.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
});

const addMemberSchema = z.object({
  studentId: z.uuid(),
});

const idParamSchema = z.object({
  id: z.uuid(),
});

const memberParamSchema = z.object({
  id: z.uuid(),
  studentId: z.uuid(),
});

router.post('/', requireAuth, requireRole('student'), validate(createSchema), create);
router.get('/mine', requireAuth, requireRole('student'), mine);
router.get('/:id', requireAuth, validateParams(idParamSchema), detail);
router.post(
  '/:id/members',
  requireAuth,
  requireRole('student'),
  validateParams(idParamSchema),
  validate(addMemberSchema),
  addMemberHandler,
);
router.delete(
  '/:id/members/:studentId',
  requireAuth,
  requireRole('student'),
  validateParams(memberParamSchema),
  removeMemberHandler,
);
router.delete('/:id', requireAuth, requireRole('student'), validateParams(idParamSchema), remove);

export default router;
