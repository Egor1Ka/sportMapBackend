import { Router } from 'express';
import * as playgroundController from '../../controllers/playgroundController.js';
import * as playgroundEditRequestController from '../../controllers/playgroundEditRequestController.js';
import * as eventController from '../../controllers/eventController.js';
import * as checkInController from '../../controllers/checkInController.js';
import { requireAuth, optionalAuth } from '../../middleware/auth.js';
import {
  uploadFor,
  handleUploadError,
  ASSET_TYPES,
} from '../../modules/media/index.js';

const router = Router();
const uploadPhoto = uploadFor(ASSET_TYPES.PLAYGROUND_PHOTO);

router.get('/', optionalAuth, playgroundController.listByBbox);
router.get('/:id', optionalAuth, playgroundController.getById);
router.post('/', requireAuth, playgroundController.create);
router.patch('/:id', requireAuth, playgroundController.update);
router.post(
  '/:id/photos',
  requireAuth,
  uploadPhoto.single('file'),
  handleUploadError,
  playgroundController.uploadPhoto,
);
router.delete('/:id/photos', requireAuth, playgroundController.deletePhoto);

router.post(
  '/:id/edit-requests',
  requireAuth,
  playgroundEditRequestController.submit,
);

router.get('/:playgroundId/events', optionalAuth, eventController.list);
router.post('/:playgroundId/events', requireAuth, eventController.create);

router.post(
  '/:playgroundId/check-in',
  requireAuth,
  checkInController.checkIn,
);
router.delete(
  '/:playgroundId/check-in',
  requireAuth,
  checkInController.checkOut,
);

export default router;
