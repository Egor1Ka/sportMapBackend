import mongoose from 'mongoose';

const sportSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true },
    icon: { type: String, default: null },
    color: { type: String, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Sport = mongoose.model('Sport', sportSchema);
