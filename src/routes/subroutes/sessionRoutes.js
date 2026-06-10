import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as sessionController from '../../controllers/sessionController.js';

const router = Router();

router.use(requireAuth);

router.post('/', sessionController.create);
router.get('/', sessionController.list);
router.get('/:id', sessionController.getById);
router.delete('/:id', sessionController.remove);

export default router;
