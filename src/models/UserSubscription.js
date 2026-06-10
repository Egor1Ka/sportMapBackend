import mongoose from 'mongoose';

const STATUS = ['queued', 'active', 'exhausted', 'expired', 'canceled'];
const SOURCE = ['manual', 'stripe', 'promo', 'creem'];

const billingSnapshotSchema = new mongoose.Schema(
  {
    durationDays: { type: Number, required: true, min: 1 },
    sessionCredits: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const planSnapshotSchema = new mongoose.Schema(
  {
    billing: { type: billingSnapshotSchema, required: true },
    entitlements: { type: mongoose.Schema.Types.Mixed, default: {} },
    name: { type: String, required: true },
  },
  { _id: false }
);

const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planCode: { type: String, required: true, trim: true },
    planVersion: { type: Number, required: true, min: 1 },
    planSnapshot: { type: planSnapshotSchema, required: true },
    status: { type: String, enum: STATUS, required: true },
    totalCredits: { type: Number, required: true, min: 0 },
    remainingCredits: { type: Number, required: true, min: 0 },
    consumedCredits: { type: Number, required: true, min: 0, default: 0 },
    queuedAt: { type: Date },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    activatedAt: { type: Date },
    closedAt: { type: Date },
    source: { type: String, enum: SOURCE, default: 'manual' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

userSubscriptionSchema.index({ userId: 1, status: 1, startsAt: 1 });
userSubscriptionSchema.index({ userId: 1, queuedAt: 1 });
userSubscriptionSchema.index({ expiresAt: 1, status: 1 });

export const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);
