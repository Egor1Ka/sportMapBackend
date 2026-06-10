import { created, ok, httpResponse, httpResponseError } from '../utils/http/httpResponse.js';
import { httpStatus } from '../utils/http/httpStatus.js';
import * as sessionService from '../services/sessionService.js';

/**
 * POST /sessions — create session for req.user.id
 */
export async function create(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(httpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' });
      return;
    }
    const body = req.body ?? {};
    const session = await sessionService.createSession(userId, body);
    created(res, session);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * GET /sessions — list sessions for current user
 * Supports ?offset=N for pagination (page index, 6 items per page)
 */
export async function list(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(httpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' });
      return;
    }
    const rawOffset = req.query?.offset;
    if (rawOffset === undefined) {
      const sessions = await sessionService.listSessionsByUser(userId);
      ok(res, sessions);
      return;
    }
    const offset = Math.max(0, parseInt(rawOffset, 10) || 0);
    const result = await sessionService.listSessionsByUserPaginated(userId, offset);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * GET /sessions/:id — one session, must belong to current user
 */
export async function getById(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(httpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' });
      return;
    }
    const sessionId = req.params?.id;
    const session = await sessionService.getSessionByIdForUser(sessionId, userId);
    ok(res, session);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * DELETE /sessions/:id — delete session if owned by current user
 */
export async function remove(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(httpStatus.UNAUTHORIZED).json({ error: 'Unauthorized' });
      return;
    }
    const sessionId = req.params?.id;
    await sessionService.deleteSessionForUser(sessionId, userId);
    httpResponse(res, httpStatus.NO_CONTENT);
  } catch (error) {
    httpResponseError(res, error);
  }
}
