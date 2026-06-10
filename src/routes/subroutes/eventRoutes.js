import { Router } from 'express';
import * as eventController from '../../controllers/eventController.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';

const router = Router();

router.get('/:id', optionalAuth, eventController.getById);
router.patch('/:id', requireAuth, eventController.update);
router.post('/:id/cancel', requireAuth, eventController.cancel);
router.post('/:id/rsvp', requireAuth, eventController.rsvp);
router.delete('/:id/rsvp', requireAuth, eventController.unrsvp);

export default router;
