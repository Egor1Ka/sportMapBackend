import { httpStatus } from './httpStatus.js';

/**
 * Send JSON response with status and optional data.
 * @param {import('express').Response} res
 * @param {number} status
 * @param {unknown} [data]
 */
export function httpResponse(res, status, data) {
  if (data === undefined) {
    res.status(status).end();
    return;
  }
  res.status(status).json(data);
}

/**
 * Send success (200) with data.
 * @param {import('express').Response} res
 * @param {unknown} data
 */
export function ok(res, data) {
  httpResponse(res, httpStatus.OK, data);
}

/**
 * Send created (201) with data.
 * @param {import('express').Response} res
 * @param {unknown} data
 */
export function created(res, data) {
  httpResponse(res, httpStatus.CREATED, data);
}

/**
 * Send error response. Handles HttpError, DomainError, and generic Error.
 * @param {import('express').Response} res
 * @param {Error & { status?: number }} error
 */
export function httpResponseError(res, error) {
  const status = error.status ?? 500;
  const message = error.message ?? 'Internal Server Error';
  const body = { error: message };
  if (error.code) {
    body.code = error.code;
  }
  if (error.details !== undefined) {
    body.details = error.details;
  }
  res.status(status).json(body);
}
