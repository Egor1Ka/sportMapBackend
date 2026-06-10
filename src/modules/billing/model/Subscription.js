import mongoose from "mongoose";
import { SUBSCRIPTION_STATUS } from "../constants/billing.js";

// NOTE: Status enum diverges from Creem SDK's SubscriptionStatus (which uses "unpaid", "trialing").
// Our model uses "past_due", "expired" instead. This is safe because billingServices.js
// derives status from WEBHOOK_STATUS_MAP[eventType], not from the raw webhook payload status field.
const subscriptionStatusValues = Object.values(SUBSCRIPTION_STATUS);

const subscriptionSchema = new mongoose.Schema(
  {
    userId:              { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    providerSubscriptionId: { type: String, required: true, unique: true },
    providerCustomerId:     { type: String, required: true },
    productId:           { type: String, required: true },
    planKey:             { type: String, required: true },
    status:              { type: String, required: true, enum: subscriptionStatusValues },
    currentPeriodStart:  { type: Date },
    currentPeriodEnd:    { type: Date },
    cancelAt:            { type: Date },
  },
  { timestamps: true },
);

subscriptionSchema.index({ userId: 1, status: 1 });

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
