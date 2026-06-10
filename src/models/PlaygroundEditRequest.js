import mongoose from 'mongoose';

const addressDiffSchema = new mongoose.Schema(
  {
    city: { type: String, default: undefined },
    district: { type: String, default: undefined },
    street: { type: String, default: undefined },
    fullAddress: { type: String, default: undefined },
  },
  { _id: false, minimize: true }
);

const diffSchema = new mongoose.Schema(
  {
    name: { type: String, default: undefined },
    description: { type: String, default: undefined },
    address: { type: addressDiffSchema, default: undefined },
    lat: { type: Number, default: undefined },
    lng: { type: Number, default: undefined },
  },
  { _id: false, minimize: true }
);

const EDIT_REQUEST_STATUSES = ['pending', 'approved', 'rejected'];

const playgroundEditRequestSchema = new mongoose.Schema(
  {
    playgroundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playground',
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    diff: { type: diffSchema, required: true, default: () => ({}) },
    status: {
      type: String,
      enum: EDIT_REQUEST_STATUSES,
      default: 'pending',
      required: true,
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

playgroundEditRequestSchema.index({ status: 1, createdAt: -1 });
playgroundEditRequestSchema.index({ playgroundId: 1, status: 1 });
playgroundEditRequestSchema.index({ authorId: 1, status: 1 });

export const PlaygroundEditRequest = mongoose.model(
  'PlaygroundEditRequest',
  playgroundEditRequestSchema
);
export { EDIT_REQUEST_STATUSES };
