// Одноразовый скрипт: выдать подписку org_creator пользователю по email.
// Запуск: node src/scripts/grantSubscription.js
//
// Использование:
//   EMAIL=zozulia@908.dp.ua node src/scripts/grantSubscription.js

import mongoose from "mongoose";
import User from "../modules/user/model/User.js";
import Subscription from "../modules/billing/model/Subscription.js";
import { SUBSCRIPTION_STATUS } from "../modules/billing/constants/billing.js";

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/myDatabase";
const TARGET_EMAIL = process.env.EMAIL || "zozulia@908.dp.ua";
const PLAN_KEY = "org_creator";

const run = async () => {
  await mongoose.connect(DB_URL);
  console.log("Connected to MongoDB");

  const user = await User.findOne({ email: TARGET_EMAIL });
  if (!user) {
    console.error(`User not found: ${TARGET_EMAIL}`);
    process.exit(1);
  }
  console.log(`Found user: ${user._id} (${user.email})`);

  const existing = await Subscription.findOne({
    userId: user._id,
    planKey: PLAN_KEY,
    status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.SCHEDULED_CANCEL] },
  });

  if (existing) {
    console.log(`User already has active ${PLAN_KEY} subscription: ${existing._id}`);
    await mongoose.disconnect();
    return;
  }

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  const subscription = await Subscription.create({
    userId: user._id,
    providerSubscriptionId: `manual_grant_${user._id}_${Date.now()}`,
    providerCustomerId: `manual_${user._id}`,
    productId: "manual_grant",
    planKey: PLAN_KEY,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    currentPeriodStart: now,
    currentPeriodEnd: oneYearLater,
  });

  console.log(`Subscription created: ${subscription._id}`);
  console.log(`  Plan: ${PLAN_KEY}`);
  console.log(`  Status: ${SUBSCRIPTION_STATUS.ACTIVE}`);
  console.log(`  Valid until: ${oneYearLater.toISOString()}`);

  await mongoose.disconnect();
  console.log("Done");
};

run().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
