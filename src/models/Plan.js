import mongoose from 'mongoose';

const billingSchema = new mongoose.Schema(
  {
    durationDays: { type: Number, required: true, min: 1 },
    sessionCredits: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const planSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    billing: { type: billingSchema, required: true },
    entitlements: { type: mongoose.Schema.Types.Mixed, default: {} },
    creemProductId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    version: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

planSchema.index({ code: 1, version: -1 }, { unique: true });
planSchema.index({ isActive: 1 });

export const Plan = mongoose.model('Plan', planSchema);
