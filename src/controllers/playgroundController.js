import { ok, created, httpResponseError } from '../utils/http/httpResponse.js';
import * as playgroundService from '../services/playgroundService.js';

/**
 * GET /playgrounds?bbox=swLng,swLat,neLng,neLat&sports=basketball,workout&limit=2000
 */
export async function listByBbox(req, res) {
  try {
    const result = await playgroundService.listByBbox(req.query ?? {}, req.user);
    ok(res, result);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * GET /playgrounds/:id
 */
export async function getById(req, res) {
  try {
    const playground = await playgroundService.getById(req.params?.id, req.user);
    ok(res, playground);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * POST /playgrounds
 */
export async function create(req, res) {
  try {
    const userId = req.user?.id ?? null;
    const playground = await playgroundService.createPlayground(userId, req.body ?? {});
    created(res, playground);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * PATCH /playgrounds/:id
 */
export async function update(req, res) {
  try {
    const playground = await playgroundService.updatePlayground(
      req.params?.id,
      req.body ?? {},
      req.user,
    );
    ok(res, playground);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * POST /playgrounds/:id/photos  (multipart/form-data, field: "file")
 */
export async function uploadPhoto(req, res) {
  try {
    if (!req.file) {
      throw new Error('file is required (multipart field "file")');
    }
    const playground = await playgroundService.addPhotoToPlayground(
      req.params?.id,
      req.file,
    );
    created(res, playground);
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * DELETE /playgrounds/:id/photos?url=...  (или body { url })
 */
export async function deletePhoto(req, res) {
  try {
    const url = req.query?.url ?? req.body?.url;
    const playground = await playgroundService.removePhotoFromPlayground(
      req.params?.id,
      url,
      req.user,
    );
    ok(res, playground);
  } catch (error) {
    httpResponseError(res, error);
  }
}
