import jwt from 'jsonwebtoken';
import { generateRefreshTokenValue } from '../utils/auth.js';
import * as userRepository from '../repository/user.js';
import * as refreshTokenRepository from '../repository/refreshToken.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES ?? '15m';
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS ?? 7);

/**
 * @param {{ id: string, email: string, name?: string }} payload
 * @returns {string}
 */
export function signAccessToken(payload) {
  return jwt.sign(
    { id: payload.id, email: payload.email, name: payload.name },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

/**
 * @param {string} token
 * @returns {{ id: string, email: string, name?: string }}
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { id: decoded.id, email: decoded.email, name: decoded.name };
  } catch {
    throw new DomainError('Invalid or expired access token', httpStatus.UNAUTHORIZED);
  }
}

/**
 * Create refresh token record and return token value.
 * @param {string} userId
 * @param {string} provider
 * @param {string} providerUserId
 * @returns {{ token: string, expiresAt: Date }}
 */
export async function createRefreshToken(userId, provider, providerUserId) {
  await refreshTokenRepository.deleteByProviderUser(userId, provider, providerUserId);
  const token = generateRefreshTokenValue();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_DAYS);

  await refreshTokenRepository.create({
    token,
    userId,
    provider,
    providerUserId,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Find user by refresh token and return user doc; invalidate old token.
 * @param {string} tokenValue
 * @returns {Promise<{ id: string, email: string, name: string, avatar?: string | null }>}
 */
export async function refreshAccess(tokenValue) {
  const doc = await refreshTokenRepository.findByToken(tokenValue);
  if (!doc) {
    throw new DomainError('Invalid refresh token', httpStatus.UNAUTHORIZED);
  }
  const user = doc.userId;
  if (!user) {
    throw new DomainError('User not found', httpStatus.UNAUTHORIZED);
  }
  if (doc.expiresAt < new Date()) {
    await refreshTokenRepository.findByIdAndDelete(tokenValue);
    throw new DomainError('Refresh token expired', httpStatus.UNAUTHORIZED);
  }
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    avatar: user.avatar ?? null,
  };
}

/**
 * Delete refresh token from DB on logout.
 * @param {string | undefined} tokenValue
 */
export async function logout(tokenValue) {
  if (tokenValue) {
    await refreshTokenRepository.findByIdAndDelete(tokenValue);
  }
}

/**
 * Find or create user by email; update avatar/name if provided.
 * @param {{ email: string, name: string, picture?: string | null }}
 * @returns {Promise<import('mongoose').Document>}
 */
export async function findOrCreateUser(profile) {
  const { email, name, picture } = profile;
  let user = await userRepository.findByEmail(email);
  if (user) {
    const updates = {};
    if (picture != null && user.avatar !== picture) updates.avatar = picture;
    if (name != null && user.name !== name) updates.name = name;
    if (Object.keys(updates).length > 0) {
      user = await userRepository.findByIdAndUpdate(user._id, updates);
    }
    return user;
  }
  return userRepository.create({
    name: name ?? 'User',
    email,
    avatar: picture ?? null,
  });
}
