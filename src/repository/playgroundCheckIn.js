import mongoose from 'mongoose';
import { PlaygroundCheckIn } from '../models/PlaygroundCheckIn.js';

const CHECK_IN_DURATION_MS = 2 * 60 * 60 * 1000;

const toObjectId = (value) =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

const buildActiveFilter = (now) => ({
  leftAt: null,
  expiresAt: { $gt: now },
});

export const activeFilter = buildActiveFilter;
export const CHECK_IN_DURATION = CHECK_IN_DURATION_MS;

export async function findActiveByUser(userId, now = new Date()) {
  return PlaygroundCheckIn.findOne({
    user: toObjectId(userId),
    ...buildActiveFilter(now),
  })
    .lean()
    .exec();
}

export async function findActiveByUserAndPlayground({ userId, playgroundId }, now = new Date()) {
  return PlaygroundCheckIn.findOne({
    user: toObjectId(userId),
    playground: toObjectId(playgroundId),
    ...buildActiveFilter(now),
  })
    .lean()
    .exec();
}

export async function leaveActiveByUser(userId, now = new Date()) {
  await PlaygroundCheckIn.updateMany(
    {
      user: toObjectId(userId),
      ...buildActiveFilter(now),
    },
    { $set: { leftAt: now } }
  ).exec();
}

export async function leaveActiveByUserOnPlayground({ userId, playgroundId }, now = new Date()) {
  await PlaygroundCheckIn.updateMany(
    {
      user: toObjectId(userId),
      playground: toObjectId(playgroundId),
      ...buildActiveFilter(now),
    },
    { $set: { leftAt: now } }
  ).exec();
}

export async function extendActiveOnPlayground({ userId, playgroundId, expiresAt }, now = new Date()) {
  const doc = await PlaygroundCheckIn.findOneAndUpdate(
    {
      user: toObjectId(userId),
      playground: toObjectId(playgroundId),
      ...buildActiveFilter(now),
    },
    { $set: { expiresAt } },
    { new: true }
  )
    .lean()
    .exec();
  return doc;
}

export async function createActive({ userId, playgroundId, now = new Date() }) {
  return PlaygroundCheckIn.create({
    user: toObjectId(userId),
    playground: toObjectId(playgroundId),
    checkedInAt: now,
    expiresAt: new Date(now.getTime() + CHECK_IN_DURATION_MS),
  });
}

export async function countActiveByPlayground(playgroundId, now = new Date()) {
  return PlaygroundCheckIn.countDocuments({
    playground: toObjectId(playgroundId),
    ...buildActiveFilter(now),
  }).exec();
}

export async function countActiveByPlaygroundIds(playgroundIds, now = new Date()) {
  const objectIds = playgroundIds.map(toObjectId);
  const docs = await PlaygroundCheckIn.aggregate([
    {
      $match: {
        playground: { $in: objectIds },
        leftAt: null,
        expiresAt: { $gt: now },
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

export async function isUserCheckedInOnPlayground({ userId, playgroundId }, now = new Date()) {
  const count = await PlaygroundCheckIn.countDocuments({
    user: toObjectId(userId),
    playground: toObjectId(playgroundId),
    ...buildActiveFilter(now),
  }).exec();
  return count > 0;
}
