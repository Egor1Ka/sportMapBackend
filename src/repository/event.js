import mongoose from 'mongoose';
import { Event } from '../models/Event.js';

const populateSportAndCreator = (query) =>
  query
    .populate({ path: 'sport' })
    .populate({ path: 'creator', select: 'name avatar' });

export function create(data) {
  return Event.create(data);
}

export async function findHydratedById(id) {
  const doc = await populateSportAndCreator(Event.findById(id)).lean().exec();
  return doc;
}

export async function findByIdRaw(id) {
  return Event.findById(id).lean().exec();
}

export async function listByPlayground({
  playgroundId,
  status,
  fromDate,
  toDate,
  sortDir = 1,
  limit,
  offset = 0,
}) {
  const filter = { playground: new mongoose.Types.ObjectId(playgroundId) };
  if (status === 'active') {
    filter.status = 'active';
  }
  if (fromDate instanceof Date || toDate instanceof Date) {
    filter.startAt = {};
    if (fromDate instanceof Date) filter.startAt.$gte = fromDate;
    if (toDate instanceof Date) filter.startAt.$lte = toDate;
  }
  const baseQuery = Event.find(filter).sort({ startAt: sortDir, _id: sortDir });
  const paginated =
    typeof limit === 'number'
      ? baseQuery.skip(offset).limit(limit)
      : baseQuery;
  const [items, total] = await Promise.all([
    populateSportAndCreator(paginated).lean().exec(),
    Event.countDocuments(filter).exec(),
  ]);
  return { items, total };
}

export async function updateById(id, patch) {
  const doc = await populateSportAndCreator(
    Event.findByIdAndUpdate(id, patch, { new: true, runValidators: true })
  )
    .lean()
    .exec();
  return doc;
}

export async function countActiveByPlaygroundIds({ playgroundIds, fromDate, toDate }) {
  const objectIds = playgroundIds.map((id) =>
    typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
  );
  const docs = await Event.aggregate([
    {
      $match: {
        playground: { $in: objectIds },
        status: 'active',
        startAt: { $gte: fromDate, $lte: toDate },
      },
    },
    { $group: { _id: '$playground', count: { $sum: 1 } } },
  ]);
  const map = new Map();
  docs.forEach((entry) => {
    map.set(entry._id.toString(), entry.count);
  });
  return map;
}

export async function countActiveByPlayground({ playgroundId, fromDate, toDate }) {
  return Event.countDocuments({
    playground: new mongoose.Types.ObjectId(playgroundId),
    status: 'active',
    startAt: { $gte: fromDate, $lte: toDate },
  }).exec();
}
