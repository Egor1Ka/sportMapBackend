import { Rating } from '../models/Rating.js';

export async function upsert({ targetType, targetId, user, value }) {
  const doc = await Rating.findOneAndUpdate(
    { targetType, targetId, user },
    { $set: { value }, $setOnInsert: { targetType, targetId, user } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  )
    .populate({ path: 'user', select: 'name' })
    .exec();
  return doc;
}

export async function getAggregate({ targetType, targetId }) {
  const result = await Rating.aggregate([
    { $match: { targetType, targetId } },
    { $group: { _id: null, average: { $avg: '$value' }, count: { $sum: 1 } } },
  ]).exec();
  if (result.length === 0) {
    return { average: null, count: 0 };
  }
  const { average, count } = result[0];
  return { average, count };
}

export async function getAggregateMap({ targetType, targetIds }) {
  const result = new Map();
  if (!Array.isArray(targetIds) || targetIds.length === 0) return result;
  const rows = await Rating.aggregate([
    { $match: { targetType, targetId: { $in: targetIds } } },
    { $group: { _id: '$targetId', average: { $avg: '$value' }, count: { $sum: 1 } } },
  ]).exec();
  const toEntry = (row) => [row._id.toString(), { average: row.average, count: row.count }];
  rows.map(toEntry).forEach(([key, value]) => result.set(key, value));
  return result;
}

export function findMine({ targetType, targetId, user }) {
  return Rating.findOne({ targetType, targetId, user }).lean().exec();
}
