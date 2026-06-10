import { Router } from 'express';
import { ok, httpResponseError } from '../../utils/http/httpResponse.js';
import { requireAuth } from '../../middleware/auth.js';
import { User } from '../../models/User.js';
import { isAdmin } from '../../utils/auth/admin.js';

const router = Router();

const toUserDTO = (doc) => ({
  id: doc._id.toString(),
  name: doc.name ?? null,
  email: doc.email ?? null,
  avatar: doc.avatar ?? null,
  isAdmin: isAdmin({ id: doc._id.toString() }),
  createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
  updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
});

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const doc = await User.findById(req.user.id).lean().exec();
    if (!doc) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    ok(res, { data: toUserDTO(doc), statusCode: 200, status: 'success' });
  } catch (error) {
    httpResponseError(res, error);
  }
});

export default router;
