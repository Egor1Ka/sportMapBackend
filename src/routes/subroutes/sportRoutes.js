import { Router } from 'express';
import * as sportController from '../../controllers/sportController.js';

const router = Router();

router.get('/', sportController.list);
router.post('/', sportController.create);

export default router;
