import mongoose from "mongoose";
import Rating from "../models/Rating.js";
import { toRatingDto } from "../dto/ratingDto.js";

const upsertRating = async ({ authorId, targetType, targetId, value }) => {
  const doc = await Rating.findOneAndUpdate(
    { authorId, targetType, targetId },
    { $set: { value } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return toRatingDto(doc);
};

const deleteOwnRating = async ({ authorId, targetType, targetId }) => {
  const doc = await Rating.findOneAndDelete({ authorId, targetType, targetId });
  return doc ? toRatingDto(doc) : null;
};

const getMyRating = async ({ authorId, targetType, targetId }) => {
  const doc = await Rating.findOne({ authorId, targetType, targetId });
  return doc ? doc.value : null;
};

const getSummary = async ({ targetType, targetId }) => {
  const [agg] = await Rating.aggregate([
    {
      $match: {
        targetType,
        targetId: new mongoose.Types.ObjectId(targetId),
      },
    },
    {
      $group: {
        _id: null,
        avg: { $avg: "$value" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (!agg) return { avg: null, count: 0 };
  return {
    avg: Math.round(agg.avg * 10) / 10,
    count: agg.count,
  };
};

const deleteByTarget = async ({ targetType, targetId }) => {
  await Rating.deleteMany({ targetType, targetId });
};

const deleteByAuthor = async (authorId) => {
  await Rating.deleteMany({ authorId });
};

export {
  upsertRating,
  deleteOwnRating,
  getMyRating,
  getSummary,
  deleteByTarget,
  deleteByAuthor,
};
