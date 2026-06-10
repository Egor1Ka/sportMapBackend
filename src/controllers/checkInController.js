import { ok, httpResponseError } from '../utils/http/httpResponse.js';
import * as checkInService from '../services/checkInService.js';

export async function checkIn(req, res) {
  try {
    const result = await checkInService.checkIn(
      req.user,
      req.params?.playgroundId
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function checkOut(req, res) {
  try {
    const result = await checkInService.checkOut(
      req.user,
      req.params?.playgroundId
    );
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}
