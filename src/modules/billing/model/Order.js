import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId:            { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    providerOrderId:   { type: String, required: true, unique: true },
    productKey:        { type: String, required: true },
    providerProductId: { type: String, required: true },
    amount:            { type: Number },
    currency:          { type: String },
    providerPayload:   { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
