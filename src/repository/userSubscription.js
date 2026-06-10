import { UserSubscription } from '../models/UserSubscription.js';

/**
 * @param {import('mongoose').FilterQuery<import('mongoose').Document>} filter
 * @param {import('mongoose').UpdateQuery<import('mongoose').Document>} update
 * @param {import('mongoose').QueryOptions} [options]
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findOneAndUpdate(filter, update, options = {}) {
  return UserSubscription.findOneAndUpdate(filter, update, options).lean().exec();
}

/**
 * @param {import('mongoose').FilterQuery<import('mongoose').Document>} filter
 * @param {import('mongoose').UpdateQuery<import('mongoose').Document>} update
 * @returns {Promise<import('mongoose').UpdateWriteOpResult>}
 */
export function updateMany(filter, update) {
  return UserSubscription.updateMany(filter, update).exec();
}

/**
 * @param {Record<string, unknown>} data
 * @returns {Promise<import('mongoose').Document>}
 */
export function create(data) {
  return UserSubscription.create(data);
}

/**
 * @param {import('mongoose').FilterQuery<import('mongoose').Document>} filter
 * @param {import('mongoose').QueryOptions} [options]
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findOne(filter, options = {}) {
  return UserSubscription.findOne(filter, null, options).lean().exec();
}

/**
 * @param {import('mongoose').FilterQuery<import('mongoose').Document>} filter
 * @param {import('mongoose').QueryOptions} [options]
 * @returns {Promise<import('mongoose').Document[]>}
 */
export function find(filter, options = {}) {
  return UserSubscription.find(filter, null, options).lean().exec();
}
