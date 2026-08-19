import { Router } from 'express';
import { z } from 'zod';
import { validate, validateParams } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { create, list, detail, update, remove, attachment } from '../controllers/assignmentController.js';

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: { message: 'File exceeds the 10MB size limit', code: 'FILE_TOO_LARGE' },
      });
    }
    if (err.message === 'INVALID_FILE_TYPE') {
      return res.status(400).json({
        error: { message: 'Only PDF and DOCX files are allowed', code: 'INVALID_FILE_TYPE' },
      });
    }
    next(err);
  });
}

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
router.delete(
  '/:id',
  requireAuth,
  requireRole('educator'),
  validateParams(idParamSchema),
  remove,
);
router.post(
  '/:id/attachment',
  requireAuth,
  requireRole('educator'),
  validateParams(idParamSchema),
  handleUpload,
  attachment,
);

export default router;
