import mongoose from "mongoose";

const BOOKING_FIELD_TYPES = ["email", "phone", "text", "textarea"];
const OWNER_TYPES = ["org", "user"];

const bookingFieldSchema = new mongoose.Schema(
  {
    ownerId:     { type: mongoose.Schema.Types.ObjectId, required: true },
    ownerType:   { type: String, required: true, enum: OWNER_TYPES },
    eventTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "EventType", default: null },
    type:        { type: String, required: true, enum: BOOKING_FIELD_TYPES },
    label:       { type: String, required: true },
    required:    { type: Boolean, default: false },
  },
  { timestamps: true },
);

bookingFieldSchema.index({ ownerId: 1, ownerType: 1, eventTypeId: 1 });

const BookingField = mongoose.model("BookingField", bookingFieldSchema);

export default BookingField;
export { BOOKING_FIELD_TYPES, OWNER_TYPES };
