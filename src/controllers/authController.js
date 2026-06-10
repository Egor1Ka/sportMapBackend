import crypto from 'crypto';
import passport from 'passport';
import { ok, httpResponseError } from '../utils/http/httpResponse.js';
import { httpResponse } from '../utils/http/httpResponse.js';
import { httpStatus } from '../utils/http/httpStatus.js';
import * as authService from '../services/authService.js';
import {
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  stateCookieOptions,
} from '../utils/cookieOptions.js';

const STATE_COOKIE = 'oauth_state';
const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

function isGoogleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, accessTokenCookieOptions);
  res.clearCookie(REFRESH_COOKIE, refreshTokenCookieOptions);
}

function setStateCookie(res, state) {
  res.cookie(STATE_COOKIE, state, stateCookieOptions);
}

function clearStateCookie(res) {
  res.clearCookie(STATE_COOKIE, stateCookieOptions);
}

function setAuthCookies(res, accessToken, refreshTokenValue, refreshExpiresAt) {
  res.cookie(ACCESS_COOKIE, accessToken, accessTokenCookieOptions);
  const opts = { ...refreshTokenCookieOptions };
  if (refreshExpiresAt) opts.maxAge = Math.floor((refreshExpiresAt - Date.now()) / 1000) * 1000;
  res.cookie(REFRESH_COOKIE, refreshTokenValue, opts);
}

/**
 * GET /auth/google — redirect to Google OAuth with state in cookie.
 */
export function getGoogle(req, res, next) {
  if (!isGoogleConfigured()) {
    res.redirect(`${FRONTEND_URL}?error=google_not_configured`);
    return;
  }
  const state = crypto.randomBytes(24).toString('hex');
  setStateCookie(res, state);
  const authenticator = passport.authenticate('google', {
    state,
    session: false,
  });
  authenticator(req, res, next);
}

/**
 * GET /auth/google/callback — verify state, set cookies, redirect to frontend.
 */
export function getGoogleCallback(req, res, next) {
  if (!isGoogleConfigured()) {
    res.redirect(`${FRONTEND_URL}?error=google_not_configured`);
    return;
  }
  const stateFromCookie = req.cookies?.[STATE_COOKIE];
  const stateFromQuery = req.query?.state;
  if (!stateFromCookie || stateFromCookie !== stateFromQuery) {
    clearStateCookie(res);
    res.redirect(`${FRONTEND_URL}?error=invalid_state`);
    return;
  }
  clearStateCookie(res);

  passport.authenticate('google', { session: false }, (err, payload) => {
    if (err) {
      console.error('[auth/google/callback] passport error:', err);
      res.redirect(`${FRONTEND_URL}?error=auth_failed`);
      return;
    }
    if (!payload?.user) {
      console.error('[auth/google/callback] empty payload:', payload);
      res.redirect(`${FRONTEND_URL}?error=no_user`);
      return;
    }
    const { user, refreshTokenValue, expiresAt } = payload;
    const accessToken = authService.signAccessToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    });
    setAuthCookies(res, accessToken, refreshTokenValue, expiresAt);
    res.redirect(FRONTEND_URL);
  })(req, res, next);
}

/**
 * POST /auth/refresh — issue new access token from refresh cookie, update access cookie.
 */
export async function postRefresh(req, res) {
  try {
    const refreshValue = req.cookies?.[REFRESH_COOKIE];
    if (!refreshValue) {
      res.status(httpStatus.UNAUTHORIZED).json({ error: 'No refresh token' });
      return;
    }
    const user = await authService.refreshAccess(refreshValue);
    const accessToken = authService.signAccessToken(user);
    res.cookie(ACCESS_COOKIE, accessToken, accessTokenCookieOptions);
    ok(res, { user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } });
  } catch (error) {
    httpResponseError(res, error);
  }
}

/**
 * GET /auth/logout — invalidate refresh token in DB, clear auth cookies and redirect to frontend.
 */
export async function getLogout(req, res) {
  const refreshValue = req.cookies?.[REFRESH_COOKIE];
  await authService.logout(refreshValue);
  clearAuthCookies(res);
  res.redirect(FRONTEND_URL);
}
