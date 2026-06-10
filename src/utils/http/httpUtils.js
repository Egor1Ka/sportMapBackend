/**
 * Parse JWT from cookie or Authorization header.
 * @param {import('express').Request} req
 * @param {string} cookieName - name of the access token cookie
 * @returns {string | null}
 */
export function parseAuthToken(req, cookieName = 'accessToken') {
  const fromCookie = req.cookies?.[cookieName];
  if (fromCookie && typeof fromCookie === 'string') {
    return fromCookie;
  }
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}
