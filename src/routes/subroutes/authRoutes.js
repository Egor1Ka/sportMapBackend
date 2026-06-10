import { Router } from 'express';
import * as authController from '../../controllers/authController.js';

const router = Router();

router.get('/google', authController.getGoogle);
router.get('/google/callback', authController.getGoogleCallback);
router.get('/logout', authController.getLogout);
router.post('/logout', authController.getLogout);
router.post('/refresh', authController.postRefresh);

export default router;
