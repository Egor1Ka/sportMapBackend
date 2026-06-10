import * as sessionRepository from '../repository/session.js';
import * as billingService from './billingService.js';
import { toDTO } from '../dto/sessionDto.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';

const SOURCES = ['live', 'upload'];

/**
 * @param {string} userId
 * @param {{ source: string, shots_made: number, shots_total: number, accuracy: number, zones?: Record<string, { attempts: number, makes: number, accuracy_pct: number }> }} body
 * @returns {Promise<{ id: string, timestamp: string, source: string, shots_made: number, shots_total: number, accuracy: number, zones: Record<string, unknown> }>}
 */
export async function createSession(userId, body) {
  const { source, shots_made, shots_total, accuracy, zones } = body;
  if (!SOURCES.includes(source)) {
    throw new DomainError('Invalid source', httpStatus.BAD_REQUEST);
  }
  if (typeof shots_made !== 'number' || typeof shots_total !== 'number' || typeof accuracy !== 'number') {
    throw new DomainError('shots_made, shots_total and accuracy are required numbers', httpStatus.BAD_REQUEST);
  }
  await billingService.consumeSessionAccess(userId);
  const doc = await sessionRepository.create({
    userId,
    source,
    shots_made,
    shots_total,
    accuracy,
    zones: zones && typeof zones === 'object' ? zones : {},
  });
  return toDTO(doc);
}

/**
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, timestamp: string, source: string, shots_made: number, shots_total: number, accuracy: number, zones: Record<string, unknown> }>>}
 */
export async function listSessionsByUser(userId) {
  const docs = await sessionRepository.findByUserId(userId);
  return docs.map((doc) => toDTO({ ...doc, _id: doc._id }));
}

const PAGE_SIZE = 6;

/**
 * @param {string} userId
 * @param {number} offset  page index (0-based), each page = PAGE_SIZE items
 * @returns {Promise<{ items: Array<object>, total: number, hasMore: boolean }>}
 */
export async function listSessionsByUserPaginated(userId, offset) {
  const skip = offset * PAGE_SIZE;
  const { items, total } = await sessionRepository.findByUserIdPaginated(userId, skip, PAGE_SIZE);
  return {
    items: items.map((doc) => toDTO({ ...doc, _id: doc._id })),
    total,
    hasMore: skip + PAGE_SIZE < total,
  };
}

/**
 * @param {string} sessionId
 * @param {string} userId
 * @returns {Promise<{ id: string, timestamp: string, source: string, shots_made: number, shots_total: number, accuracy: number, zones: Record<string, unknown> }>}
 */
export async function getSessionByIdForUser(sessionId, userId) {
  const doc = await sessionRepository.findByIdAndUserId(sessionId, userId);
  if (!doc) {
    throw new DomainError('Session not found', httpStatus.NOT_FOUND);
  }
  return toDTO({ ...doc, _id: doc._id });
}

/**
 * @param {string} sessionId
 * @param {string} userId
 */
export async function deleteSessionForUser(sessionId, userId) {
  const doc = await sessionRepository.findByIdAndUserIdAndDelete(sessionId, userId);
  if (!doc) {
    throw new DomainError('Session not found', httpStatus.NOT_FOUND);
  }
}
