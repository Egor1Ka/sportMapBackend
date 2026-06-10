import { RefreshToken } from '../models/RefreshToken.js';

/**
 * @param {{ token: string, userId: import('mongoose').Types.ObjectId, provider: string, providerUserId: string, expiresAt: Date }}
 * @returns {Promise<import('mongoose').Document>}
 */
export function create(data) {
  return RefreshToken.create(data);
}

/**
 * @param {string} token
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findByToken(token) {
  return RefreshToken.findOne({ token }).populate('userId').exec();
}

/**
 * @param {string} token
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findByIdAndDelete(token) {
  return RefreshToken.findOneAndDelete({ token }).exec();
}

/**
 * @param {import('mongoose').Types.ObjectId | string} userId
 * @returns {Promise<import('mongoose').mongo.DeleteResult>}
 */
export function deleteByProviderUser(userId, provider, providerUserId) {
  return RefreshToken.deleteMany({ userId, provider, providerUserId }).exec();
}
