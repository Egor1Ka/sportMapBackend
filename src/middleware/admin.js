import { httpStatus } from '../utils/http/httpStatus.js';
import { isAdmin } from '../utils/auth/admin.js';

/**
 * Middleware: requires the user to be authenticated AND in the ADMIN_IDS env list.
 * Must be placed AFTER requireAuth.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    res.status(httpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' });
    return;
  }
  if (!isAdmin(req.user)) {
    res.status(httpStatus.FORBIDDEN).json({ error: 'Admin access required' });
    return;
  }
  next();
}
