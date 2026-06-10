// src/scripts/migrateBookingStatuses.js
//
// Одноразовый скрипт миграции:
// 1. Для каждого User — создать дефолтные статусы + defaultBookingStatusId
// 2. Для каждой Organization — создать дефолтные статусы + defaultBookingStatusId
// 3. Все Booking — установить statusId = status_unconfirmed в соответствующем scope
// 4. Удалить поле status из всех Booking
//
// Запуск: node src/scripts/migrateBookingStatuses.js

import mongoose from "mongoose";
import User from "../modules/user/model/User.js";
import Organization from "../models/Organization.js";
import Booking from "../models/Booking.js";
import BookingStatus from "../models/BookingStatus.js";
import { DEFAULT_STATUSES } from "../constants/bookingStatus.js";

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/myDatabase";

const run = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Step 1: Users
  const users = await User.find({});
  console.log(`Found ${users.length} users`);

  for (const user of users) {
    const existing = await BookingStatus.countDocuments({ userId: user._id, orgId: null });
    if (existing > 0) {
      console.log(`  User ${user._id}: statuses already exist, skip`);
      continue;
    }

    const toStatusData = (template) => ({
      ...template,
      orgId: null,
      userId: user._id,
    });
    const docs = await BookingStatus.insertMany(DEFAULT_STATUSES.map(toStatusData));
    const unconfirmed = docs.find((d) => d.label === "status_unconfirmed");
    if (unconfirmed) {
      await User.findByIdAndUpdate(user._id, { defaultBookingStatusId: unconfirmed._id });
    }
    console.log(`  User ${user._id}: created ${docs.length} statuses`);
  }

  // Step 2: Organizations
  const orgs = await Organization.find({});
  console.log(`Found ${orgs.length} organizations`);

  for (const org of orgs) {
    const existing = await BookingStatus.countDocuments({ orgId: org._id });
    if (existing > 0) {
      console.log(`  Org ${org._id}: statuses already exist, skip`);
      continue;
    }

    const toStatusData = (template) => ({
      ...template,
      orgId: org._id,
      userId: null,
    });
    const docs = await BookingStatus.insertMany(DEFAULT_STATUSES.map(toStatusData));
    const unconfirmed = docs.find((d) => d.label === "status_unconfirmed");
    if (unconfirmed) {
      await Organization.findByIdAndUpdate(org._id, { defaultBookingStatusId: unconfirmed._id });
    }
    console.log(`  Org ${org._id}: created ${docs.length} statuses`);
  }

  // Step 3: Migrate bookings
  const bookings = await Booking.find({}).select("_id orgId hosts status");
  console.log(`Found ${bookings.length} bookings to migrate`);

  let migrated = 0;
  for (const booking of bookings) {
    const orgId = booking.orgId;
    const userId = orgId ? null : booking.hosts[0]?.userId;

    const query = orgId
      ? { orgId, label: "status_unconfirmed" }
      : { userId, orgId: null, label: "status_unconfirmed" };

    const targetStatus = await BookingStatus.findOne(query);
    if (!targetStatus) {
      console.log(`  Booking ${booking._id}: no unconfirmed status found, skip`);
      continue;
    }

    await Booking.updateOne(
      { _id: booking._id },
      { $set: { statusId: targetStatus._id }, $unset: { status: "" } },
    );
    migrated++;
  }

  console.log(`Migrated ${migrated} bookings`);

  // Step 4: Удалить поле status из оставшихся (если есть)
  const remaining = await Booking.updateMany(
    { status: { $exists: true } },
    { $unset: { status: "" } },
  );
  console.log(`Cleaned up ${remaining.modifiedCount} remaining status fields`);

  await mongoose.disconnect();
  console.log("Migration complete");
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
