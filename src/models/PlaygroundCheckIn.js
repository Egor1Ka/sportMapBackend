import mongoose from 'mongoose';

const playgroundCheckInSchema = new mongoose.Schema(
  {
    playground: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playground',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    checkedInAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    leftAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

playgroundCheckInSchema.index({ playground: 1, leftAt: 1, expiresAt: 1 });
playgroundCheckInSchema.index({ user: 1, leftAt: 1, expiresAt: 1 });

export const PlaygroundCheckIn = mongoose.model(
  'PlaygroundCheckIn',
  playgroundCheckInSchema
);
