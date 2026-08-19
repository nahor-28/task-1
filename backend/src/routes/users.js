import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { me } from '../controllers/userController.js';

const router = Router();

router.get('/me', requireAuth, me);

export default router;
