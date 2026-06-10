import { Router } from 'express';
import * as commentController from '../../controllers/commentController.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.get('/', commentController.list);
router.post('/', requireAuth, commentController.create);
router.delete('/:id', requireAuth, commentController.remove);

export default router;
