import { ok, httpResponseError } from '../utils/http/httpResponse.js';
import * as ratingService from '../services/ratingService.js';

export async function upsert(req, res) {
  try {
    const rating = await ratingService.upsertRating(req.user, req.body ?? {});
    ok(res, rating);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function aggregate(req, res) {
  try {
    const result = await ratingService.getAggregate(req.query ?? {});
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function mine(req, res) {
  try {
    const result = await ratingService.getMine(req.user, req.query ?? {});
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}
