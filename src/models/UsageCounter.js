import mongoose from 'mongoose';

const COUNTER_TYPE = ['free_sessions_monthly'];

const usageCounterSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    counterType: { type: String, enum: COUNTER_TYPE, required: true },
    periodKey: { type: String, required: true, trim: true },
    used: { type: Number, required: true, min: 0, default: 0 },
    limitSnapshot: { type: Number, required: true, min: 0 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
  },
  { timestamps: true }
);

usageCounterSchema.index({ userId: 1, counterType: 1, periodKey: 1 }, { unique: true });

export const UsageCounter = mongoose.model('UsageCounter', usageCounterSchema);
