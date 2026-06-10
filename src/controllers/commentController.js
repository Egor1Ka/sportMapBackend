import { ok, created, httpResponseError } from '../utils/http/httpResponse.js';
import * as commentService from '../services/commentService.js';

export async function create(req, res) {
  try {
    const comment = await commentService.createComment(req.user, req.body ?? {});
    created(res, comment);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function list(req, res) {
  try {
    const result = await commentService.listComments(req.query ?? {});
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function remove(req, res) {
  try {
    const result = await commentService.deleteComment(req.user, req.params?.id);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}
