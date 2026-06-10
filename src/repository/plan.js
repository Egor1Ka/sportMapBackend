import { Plan } from '../models/Plan.js';

/**
 * @param {string} code
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findLatestActiveByCode(code) {
  return Plan.findOne({ code, isActive: true }).sort({ version: -1 }).lean().exec();
}
