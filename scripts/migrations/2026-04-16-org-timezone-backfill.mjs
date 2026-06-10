#!/usr/bin/env node
import "dotenv/config";
import mongoose from "mongoose";

const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO) {
  console.error("Set MONGO_URI in env");
  process.exit(1);
}

await mongoose.connect(MONGO);
const Org = mongoose.connection.db.collection("organizations");

const res = await Org.updateMany(
  { timezone: { $exists: false } },
  [
    { $set: { timezone: { $ifNull: ["$settings.defaultTimezone", "Europe/Kyiv"] } } },
    { $unset: "settings.defaultTimezone" },
  ]
);

console.log(`Backfilled ${res.modifiedCount} organizations.`);
await mongoose.disconnect();
