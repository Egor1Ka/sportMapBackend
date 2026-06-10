/**
 * Base HTTP error with status code.
 */
export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

/**
 * Domain/business logic error (e.g. validation, not found).
 */
export class DomainError extends Error {
  /**
   * @param {string} message
   * @param {number} [status=400]
   * @param {{ code?: string, details?: unknown }} [payload]
   */
  constructor(message, status = 400, payload = {}) {
    super(message);
    this.status = status;
    this.name = 'DomainError';
    this.code = payload.code;
    this.details = payload.details;
  }
}
