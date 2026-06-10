#!/usr/bin/env node
import "dotenv/config";
import mongoose from "mongoose";

const DB_URL = process.env.DB_URL || process.env.MONGO_URI || process.env.MONGODB_URI;
if (!DB_URL) {
  console.error("Set DB_URL (or MONGO_URI) in env");
  process.exit(1);
}

await mongoose.connect(DB_URL);
const payments = mongoose.connection.db.collection("payments");

const before = await payments.countDocuments();
await payments.deleteMany({});

const existingIndexes = await payments.indexes().catch(() => []);
const hasUniqueProviderEventId = existingIndexes.some(
  (idx) => idx.name === "providerEventId_1" && idx.unique,
);
if (!hasUniqueProviderEventId) {
  const dropTarget = existingIndexes.find((idx) => idx.name === "providerEventId_1");
  if (dropTarget) await payments.dropIndex("providerEventId_1");
  await payments.createIndex({ providerEventId: 1 }, { unique: true });
}

console.log(`[migration] removed ${before} payments, providerEventId unique index ensured.`);
await mongoose.disconnect();
