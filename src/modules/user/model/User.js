import mongoose from "mongoose";

const { Schema, model } = mongoose;

const UserSchema = new Schema(
  {
    name:        { type: String, required: true },
    email:       { type: String, required: true, unique: true },
    avatar:      { type: String },
    description: { type: String, default: null },
    address:     { type: String, default: null },
    phone:       { type: String, default: null },
    website:     { type: String, default: null },
    telegramChatId: { type: String, default: null },

    /**
     * Дефолтный статус для новых бронирований в персональном расписании.
     */
    defaultBookingStatusId: {
      type: Schema.Types.ObjectId,
      ref: "BookingStatus",
      default: null,
    },
  },
  { timestamps: true }
);

export default model("User", UserSchema);
