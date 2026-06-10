import mongoose from "mongoose";
import { VALID_ACTIONS, isAllowedColor } from "../constants/bookingStatus.js";

const { Schema, model } = mongoose;

const BookingStatusSchema = new Schema(
  {
    label: { type: String, required: true },
    color: {
      type: String,
      required: true,
      validate: {
        validator: isAllowedColor,
        message: "Color must be hex (#RRGGBB) or a legacy named color",
      },
    },
    actions: {
      type: [String],
      validate: {
        validator: (arr) => arr.every((a) => VALID_ACTIONS.includes(a)),
        message: "Invalid action in actions array",
      },
      default: [],
    },
    isDefault: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

BookingStatusSchema.index({ label: 1, orgId: 1, userId: 1 }, { unique: true });
BookingStatusSchema.index({ orgId: 1, isArchived: 1 });
BookingStatusSchema.index({ actions: 1, orgId: 1 });

export default model("BookingStatus", BookingStatusSchema);
