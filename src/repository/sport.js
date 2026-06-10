import { Sport } from '../models/Sport.js';

/**
 * @returns {Promise<import('mongoose').Document[]>}
 */
export function findAll() {
  return Sport.find().sort({ order: 1, label: 1 }).lean().exec();
}

/**
 * @param {string} code
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findByCode(code) {
  return Sport.findOne({ code }).lean().exec();
}

/**
 * @param {{ code: string, label: string, icon?: string, color?: string, order?: number }} data
 * @returns {Promise<import('mongoose').Document>}
 */
export function create(data) {
  return Sport.create(data);
}
