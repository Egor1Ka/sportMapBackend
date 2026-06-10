import { UsageCounter } from '../models/UsageCounter.js';

/**
 * @param {import('mongoose').FilterQuery<import('mongoose').Document>} filter
 * @param {import('mongoose').UpdateQuery<import('mongoose').Document>} update
 * @param {import('mongoose').QueryOptions} [options]
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findOneAndUpdate(filter, update, options = {}) {
  return UsageCounter.findOneAndUpdate(filter, update, options).lean().exec();
}

/**
 * @param {import('mongoose').FilterQuery<import('mongoose').Document>} filter
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findOne(filter) {
  return UsageCounter.findOne(filter).lean().exec();
}
