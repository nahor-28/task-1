import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { get, dashboard } from '../controllers/reportController.js';

const router = Router();

const reportQuerySchema = z
  .object({
    studentId: z.uuid().optional(),
    groupId: z.uuid().optional(),
  })
  .refine((data) => Boolean(data.studentId) !== Boolean(data.groupId), {
    message: 'Provide exactly one of studentId or groupId',
  });

router.get('/dashboard', requireAuth, dashboard);
router.get('/', requireAuth, validateQuery(reportQuerySchema), get);

export default router;
