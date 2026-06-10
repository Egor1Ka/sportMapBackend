/**
 * Cookie options from env for auth cookies.
 * COOKIE_DOMAIN, COOKIE_SECURE (true/false), COOKIE_SAME_SITE (Lax|Strict|None), maxAge in ms for access/refresh.
 */
const secure = process.env.COOKIE_SECURE === 'true';
const sameSite = process.env.COOKIE_SAME_SITE ?? 'Lax';

export const defaultCookieOptions = {
  httpOnly: true,
  secure,
  sameSite: sameSite === 'None' ? 'none' : sameSite === 'Strict' ? 'strict' : 'lax',
  path: '/',
  ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
};

const accessMaxAge = Number(process.env.COOKIE_MAX_AGE_ACCESS_MS ?? 15 * 60 * 1000);
const refreshMaxAge = Number(process.env.COOKIE_MAX_AGE_REFRESH_MS ?? 7 * 24 * 60 * 60 * 1000);

export const accessTokenCookieOptions = {
  ...defaultCookieOptions,
  maxAge: accessMaxAge,
};

export const refreshTokenCookieOptions = {
  ...defaultCookieOptions,
  maxAge: refreshMaxAge,
};

const stateMaxAge = 10 * 60 * 1000;

export const stateCookieOptions = {
  ...defaultCookieOptions,
  maxAge: stateMaxAge,
};
