import mongoose from 'mongoose';

export const RATING_TARGET_TYPES = ['playground'];

const ratingSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: RATING_TARGET_TYPES,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: (v) => Number.isInteger(v),
        message: 'value must be an integer between 1 and 5',
      },
    },
  },
  { timestamps: true }
);

ratingSchema.index({ targetType: 1, targetId: 1, user: 1 }, { unique: true });
ratingSchema.index({ targetType: 1, targetId: 1 });

export const Rating = mongoose.model('Rating', ratingSchema);
