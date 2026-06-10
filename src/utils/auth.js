import crypto from 'crypto';

/**
 * Generate a random string for refresh token.
 * @param {number} [length=64]
 * @returns {string}
 */
export function generateRefreshTokenValue(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}
