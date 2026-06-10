import { User } from '../models/User.js';

/**
 * @param {{ name: string, email: string, avatar?: string | null }}
 * @returns {Promise<import('mongoose').Document>}
 */
export function create(data) {
  return User.create(data);
}

/**
 * @param {string} email
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findByEmail(email) {
  return User.findOne({ email }).exec();
}

/**
 * @param {import('mongoose').Types.ObjectId} id
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findById(id) {
  return User.findById(id).exec();
}

/**
 * @param {import('mongoose').Types.ObjectId} id
 * @param {{ avatar?: string | null, name?: string }}
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findByIdAndUpdate(id, update) {
  return User.findByIdAndUpdate(id, update, { new: true }).exec();
}
