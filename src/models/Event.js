import mongoose from 'mongoose';

export const EVENT_STATUSES = ['active', 'cancelled', 'finished'];

const eventSchema = new mongoose.Schema(
  {
    playground: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playground',
      required: true,
    },
    sport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sport',
      required: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    durationMin: {
      type: Number,
      required: true,
      min: 15,
      max: 480,
      default: 60,
    },
    description: {
      type: String,
      default: null,
      maxlength: 280,
      trim: true,
    },
    maxParticipants: {
      type: Number,
      default: null,
      min: 2,
      max: 100,
    },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      required: true,
      default: 'active',
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

eventSchema.index({ playground: 1, status: 1, startAt: 1 });
eventSchema.index({ creator: 1, startAt: -1 });
eventSchema.index({ startAt: 1 });

export const Event = mongoose.model('Event', eventSchema);
