import mongoose from 'mongoose';
import { PlaygroundEditRequest } from '../models/PlaygroundEditRequest.js';

const buildStatusFilter = (status) => (status ? { status } : {});

const toObjectIdSafe = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

/**
 * @param {{ playgroundId: string, authorId: string, diff: object }} data
 */
export function create(data) {
  return PlaygroundEditRequest.create({
    playgroundId: data.playgroundId,
    authorId: data.authorId,
    diff: data.diff,
    status: 'pending',
  });
}

/**
 * @param {string} id
 */
export function findById(id) {
  return PlaygroundEditRequest.findById(id)
    .populate('authorId', 'name email')
    .lean()
    .exec();
}

/**
 * @param {string} id
 */
export function findByIdRaw(id) {
  return PlaygroundEditRequest.findById(id).exec();
}

/**
 * @param {{ status?: string, limit?: number, skip?: number }} params
 */
export async function findMany({ status, limit = 50, skip = 0 } = {}) {
  const filter = buildStatusFilter(status);
  const cappedLimit = Math.min(Math.max(limit, 1), 200);
  const [items, total] = await Promise.all([
    PlaygroundEditRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(cappedLimit)
      .populate('authorId', 'name email')
      .lean()
      .exec(),
    PlaygroundEditRequest.countDocuments(filter).exec(),
  ]);
  return { items, total, limit: cappedLimit };
}

export function countByStatus(status) {
  return PlaygroundEditRequest.countDocuments(buildStatusFilter(status)).exec();
}

/**
 * @param {string} id
 * @param {{ status: string, resolvedBy: string }} update
 */
export function resolveById(id, { status, resolvedBy }) {
  const resolverId = toObjectIdSafe(resolvedBy);
  return PlaygroundEditRequest.findByIdAndUpdate(
    id,
    {
      status,
      resolvedAt: new Date(),
      resolvedBy: resolverId,
    },
    { new: true }
  )
    .lean()
    .exec();
}

/**
 * Cascade: when a playground is deleted, reject all its pending requests.
 * @param {string} playgroundId
 */
export function rejectAllPendingForPlayground(playgroundId) {
  return PlaygroundEditRequest.updateMany(
    { playgroundId, status: 'pending' },
    { $set: { status: 'rejected', resolvedAt: new Date(), resolvedBy: null } }
  ).exec();
}
