import mongoose from 'mongoose';
import { EventRsvp } from '../models/EventRsvp.js';

const toObjectId = (value) =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

export async function findOne({ eventId, userId }) {
  return EventRsvp.findOne({
    event: toObjectId(eventId),
    user: toObjectId(userId),
  })
    .lean()
    .exec();
}

export async function createIfMissing({ eventId, userId }) {
  try {
    const doc = await EventRsvp.create({
      event: toObjectId(eventId),
      user: toObjectId(userId),
    });
    return { doc, created: true };
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await findOne({ eventId, userId });
      return { doc: existing, created: false };
    }
    throw error;
  }
}

export async function deleteOne({ eventId, userId }) {
  const result = await EventRsvp.deleteOne({
    event: toObjectId(eventId),
    user: toObjectId(userId),
  }).exec();
  return result.deletedCount > 0;
}

export async function countByEvent(eventId) {
  return EventRsvp.countDocuments({ event: toObjectId(eventId) }).exec();
}
