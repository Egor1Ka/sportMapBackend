import mongoose from "mongoose";

const positionPricingSchema = new mongoose.Schema(
  {
    orgId:       { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    eventTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "EventType", required: true },
    positionId:  { type: mongoose.Schema.Types.ObjectId, ref: "Position", required: true },
    price: {
      amount: { type: Number, required: true, min: 0 },
    },
  },
  { timestamps: true },
);

positionPricingSchema.index({ eventTypeId: 1, positionId: 1 }, { unique: true });
positionPricingSchema.index({ orgId: 1 });

const PositionPricing = mongoose.model("PositionPricing", positionPricingSchema);

export default PositionPricing;
