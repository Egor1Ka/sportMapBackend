import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId:              { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    providerSubscriptionId: { type: String },
    providerEventId:        { type: String, required: true, unique: true },
    productId:           { type: String, required: true },
    type:                { type: String, required: true, enum: ["subscription", "one_time"] },
    eventType:           { type: String, required: true },
    amount:              { type: Number },
    currency:            { type: String },
    providerPayload:        { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

paymentSchema.index({ userId: 1, type: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
