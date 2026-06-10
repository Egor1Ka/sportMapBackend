import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as billingController from '../../controllers/billingController.js';

const router = Router();

router.use(requireAuth);
router.get('/status', billingController.getStatus);

export default router;
