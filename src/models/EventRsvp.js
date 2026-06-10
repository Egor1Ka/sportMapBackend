import mongoose from 'mongoose';

const eventRsvpSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

eventRsvpSchema.index({ event: 1, user: 1 }, { unique: true });
eventRsvpSchema.index({ user: 1, createdAt: -1 });

export const EventRsvp = mongoose.model('EventRsvp', eventRsvpSchema);
