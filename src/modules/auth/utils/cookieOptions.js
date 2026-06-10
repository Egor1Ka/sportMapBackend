import { parseDurationMs } from "../../../shared/utils/duration.js";

const { NODE_ENV, JWT_ACCESS_EXPIRES, JWT_REFRESH_EXPIRES } = process.env;

const MS_IN_M = 60_000;
const MS_IN_D = 86_400_000;

const DEFAULT_ACCESS_MS  = 15 * MS_IN_M;
const DEFAULT_REFRESH_MS = 30 * MS_IN_D;
const STATE_COOKIE_MAX_AGE_MS = 10 * MS_IN_M;

export const COOKIE_NAMES = {
  state:   "oauth_state",
  access:  "accessToken",
  refresh: "refreshToken",
};

const isSecure = NODE_ENV === "production";

const buildCookieOptions = (maxAge) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: isSecure,
  maxAge,
});

export const stateCookieOptions = buildCookieOptions(STATE_COOKIE_MAX_AGE_MS);

export const accessCookieOptions = buildCookieOptions(
  parseDurationMs(JWT_ACCESS_EXPIRES, DEFAULT_ACCESS_MS)
);

export const refreshCookieOptions = buildCookieOptions(
  parseDurationMs(JWT_REFRESH_EXPIRES, DEFAULT_REFRESH_MS)
);
