import { Session } from '../models/Session.js';

/**
 * @param {{ userId: import('mongoose').Types.ObjectId, timestamp?: Date, source: string, shots_made: number, shots_total: number, accuracy: number, zones?: Record<string, unknown> }}
 * @returns {Promise<import('mongoose').Document>}
 */
export function create(data) {
  return Session.create(data);
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 * @returns {Promise<import('mongoose').Document[]>}
 */
export function findByUserId(userId) {
  return Session.find({ userId }).sort({ timestamp: -1 }).lean().exec();
}

/**
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {number} skip
 * @param {number} limit
 * @returns {Promise<{ items: import('mongoose').Document[], total: number }>}
 */
export async function findByUserIdPaginated(userId, skip, limit) {
  const [items, total] = await Promise.all([
    Session.find({ userId }).sort({ timestamp: -1 }).skip(skip).limit(limit).lean().exec(),
    Session.countDocuments({ userId }).exec(),
  ]);
  return { items, total };
}

/**
 * @param {import('mongoose').Types.ObjectId} id
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findById(id) {
  return Session.findById(id).lean().exec();
}

/**
 * @param {import('mongoose').Types.ObjectId} id
 * @param {import('mongoose').Types.ObjectId} userId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findByIdAndUserId(id, userId) {
  return Session.findOne({ _id: id, userId }).lean().exec();
}

/**
 * @param {import('mongoose').Types.ObjectId} id
 * @param {import('mongoose').Types.ObjectId} userId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findByIdAndUserIdAndDelete(id, userId) {
  return Session.findOneAndDelete({ _id: id, userId }).exec();
}
