import { Router } from 'express';
import * as ratingController from '../../controllers/ratingController.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.get('/aggregate', ratingController.aggregate);
router.get('/me', requireAuth, ratingController.mine);
router.put('/', requireAuth, ratingController.upsert);

export default router;
