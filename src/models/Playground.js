import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: 'coordinates must be [lng, lat]',
      },
    },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    city: { type: String, default: null },
    district: { type: String, default: null },
    street: { type: String, default: null },
    fullAddress: { type: String, default: null },
  },
  { _id: false }
);

const playgroundSchema = new mongoose.Schema(
  {
    name: { type: String, default: null },
    description: { type: String, default: null },
    location: { type: pointSchema, required: true },
    address: { type: addressSchema, default: () => ({}) },
    sports: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sport' }], default: [] },
    photos: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

playgroundSchema.index({ location: '2dsphere' });
playgroundSchema.index({ sports: 1 });
playgroundSchema.index({ 'address.city': 1 });

export const Playground = mongoose.model('Playground', playgroundSchema);
