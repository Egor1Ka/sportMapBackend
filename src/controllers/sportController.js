import { ok, created, httpResponseError } from '../utils/http/httpResponse.js';
import * as sportService from '../services/sportService.js';

/**
 * GET /sports — list all sports (public dictionary)
 */
export async function list(req, res) {
  try {
    const items = await sportService.listSports();
    ok(res, { items });
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * POST /sports — create a sport entry (admin)
 */
export async function create(req, res) {
  try {
    const sport = await sportService.createSport(req.body ?? {});
    created(res, sport);
  } catch (error) {
    httpResponseError(res, error);
  }
}
