import { ok, created, httpResponseError } from '../utils/http/httpResponse.js';
import * as service from '../services/playgroundEditRequestService.js';

/**
 * POST /playgrounds/:id/edit-requests
 */
export async function submit(req, res) {
  try {
    const result = await service.submitRequest(
      req.params?.id,
      req.user,
      req.body?.diff
    );
    created(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * GET /admin/playground-edit-requests
 */
export async function list(req, res) {
  try {
    const status = req.query?.status;
    const limit = req.query?.limit ? Number.parseInt(req.query.limit, 10) : undefined;
    const skip = req.query?.skip ? Number.parseInt(req.query.skip, 10) : undefined;
    const result = await service.listRequests({ status, limit, skip });
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * GET /admin/playground-edit-requests/count
 */
export async function pendingCount(_req, res) {
  try {
    const result = await service.getPendingCount();
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * GET /admin/playground-edit-requests/:id
 */
export async function getById(req, res) {
  try {
    const result = await service.getRequestById(req.params?.id);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * POST /admin/playground-edit-requests/:id/approve
 */
export async function approve(req, res) {
  try {
    const playground = await service.approveRequest(req.params?.id, req.user);
    ok(res, playground);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * POST /admin/playground-edit-requests/:id/reject
 */
export async function reject(req, res) {
  try {
    const request = await service.rejectRequest(req.params?.id, req.user);
    ok(res, request);
  } catch (error) {
    httpResponseError(res, error);
  }
}
