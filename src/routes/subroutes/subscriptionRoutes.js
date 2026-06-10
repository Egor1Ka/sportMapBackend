import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as billingController from '../../controllers/billingController.js';

const router = Router();

router.use(requireAuth);
router.post('/purchase', billingController.postPurchase);
router.post('/checkout', billingController.postCheckout);

export default router;
