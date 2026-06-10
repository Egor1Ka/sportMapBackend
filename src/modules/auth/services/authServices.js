import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getUser, updateUser, createUser as createUserRecord, getUserById } from "../../user/index.js";
import {
  createRefreshToken,
  getRefreshTokenByToken,
  deleteRefreshTokensByUserAndProvider,
  deleteRefreshTokenByToken,
} from "../repository/refreshTokenRepository.js";
import { parseDurationMs } from "../../../shared/utils/duration.js";
import { REFRESH_BYTES, STATE_BYTES } from "../constants/auth.js";
import { createDefaultSchedule } from "../../../services/scheduleServices.js";
import { isValidTimezone } from "../../../shared/utils/timezone.js";
import { seedDefaultStatuses } from "../../../services/bookingStatusServices.js";

const { JWT_SECRET, JWT_ACCESS_EXPIRES, JWT_REFRESH_EXPIRES } = process.env;

const DEFAULT_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

// ── JWT ──────────────────────────────────────────────────────────────────────

const createAccessToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES });

const verifyAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
};

// ── OAuth state ───────────────────────────────────────────────────────────────

const createOauthState = (timezone) => {
  if (!timezone || !isValidTimezone(timezone)) throw new Error("invalid_timezone");
  const state = crypto.randomBytes(STATE_BYTES).toString("base64url");
  const payload = JSON.stringify({ s: state, tz: timezone });
  const cookieValue = Buffer.from(payload).toString("base64url");
  return { state, cookieValue };
};

const validateOauthState = (cookieValue, receivedState) => {
  if (!cookieValue || !receivedState) throw new Error("missing_state");
  const raw = Buffer.from(cookieValue, "base64url").toString("utf8");
  const parsed = JSON.parse(raw);
  if (parsed.s !== receivedState) throw new Error("invalid_state");
  return { timezone: parsed.tz };
};

// ── User ──────────────────────────────────────────────────────────────────────

const buildNormalizedUser = (profile) => ({
  name: profile.name,
  email: profile.email,
  avatar: profile.avatar,
});

const findOrCreateUser = async (profile, timezone) => {
  const existing = await getUser({ email: profile.email });

  if (existing) {
    if (!existing.avatar && profile.avatar) {
      return updateUser(existing.id, {
        avatar: profile.avatar,
      });
    }
    return existing;
  }

  const newUser = await createUserRecord(buildNormalizedUser(profile));

  if (!timezone || !isValidTimezone(timezone)) throw new Error("timezone_required");
  console.log("[registration] new user created:", newUser.id, "timezone:", timezone);
  await createDefaultSchedule(newUser.id, null, timezone).catch((err) =>
    console.error("[createDefaultSchedule] registration failed:", err.message, err.stack),
  );
  console.log("[registration] createDefaultSchedule done for user:", newUser.id);
  await seedDefaultStatuses(null, newUser.id).catch((err) =>
    console.error("[seedDefaultStatuses] registration failed:", err.message, err.stack),
  );
  console.log("[registration] seedDefaultStatuses done for user:", newUser.id);

  return newUser;
};

// ── Tokens ────────────────────────────────────────────────────────────────────

const buildAccessTokenPayload = (user, provider) => ({
  id: user.id,
  provider,
  email: user.email,
  name: user.name,
});

const buildRefreshTokenRecord = (userId, provider, providerUserId, token) => ({
  token,
  userId,
  provider,
  providerUserId,
  expiresAt: new Date(
    Date.now() + parseDurationMs(JWT_REFRESH_EXPIRES, DEFAULT_REFRESH_MS),
  ),
});

const createSession = async (user, provider, providerUserId) => {
  await deleteRefreshTokensByUserAndProvider(
    user.id,
    provider,
  );

  const refreshToken = crypto.randomBytes(REFRESH_BYTES).toString("hex");
  const record = buildRefreshTokenRecord(
    user.id,
    provider,
    providerUserId,
    refreshToken,
  );
  await createRefreshToken(record);

  const accessToken = createAccessToken(
    buildAccessTokenPayload(user, provider),
  );

  return { accessToken, refreshToken };
};

// ── Session refresh ───────────────────────────────────────────────────────────

const refreshSession = async (refreshToken) => {
  const stored =
    await getRefreshTokenByToken(refreshToken);

  if (!stored || stored.expiresAt <= new Date()) return null;

  const user = await getUserById(stored.userId);

  if (!user) return null;

  const accessToken = createAccessToken(
    buildAccessTokenPayload(user, stored.provider),
  );

  return { accessToken };
};

const revokeSession = async (refreshToken) => {
  await deleteRefreshTokenByToken(refreshToken);
};

export {
  createAccessToken,
  verifyAccessToken,
  createOauthState,
  validateOauthState,
  findOrCreateUser,
  buildAccessTokenPayload,
  createSession,
  refreshSession,
  revokeSession,
};
