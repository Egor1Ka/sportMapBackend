import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/admin.js';
import * as controller from '../../controllers/playgroundEditRequestController.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/', controller.list);
router.get('/count', controller.pendingCount);
router.get('/:id', controller.getById);
router.post('/:id/approve', controller.approve);
router.post('/:id/reject', controller.reject);

export default router;
