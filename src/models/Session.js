import mongoose from 'mongoose';

const zoneValueSchema = new mongoose.Schema(
  {
    attempts: { type: Number, required: true },
    makes: { type: Number, required: true },
    accuracy_pct: { type: Number, required: true },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    source: { type: String, enum: ['live', 'upload'], required: true },
    shots_made: { type: Number, required: true },
    shots_total: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    zones: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1 });
sessionSchema.index({ userId: 1, timestamp: -1 });

export const Session = mongoose.model('Session', sessionSchema);
