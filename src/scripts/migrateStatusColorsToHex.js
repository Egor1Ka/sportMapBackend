// src/scripts/migrateStatusColorsToHex.js
//
// Идемпотентный скрипт миграции:
// - Конвертирует существующие BookingStatus.color из именованных
//   ('blue', 'green', ...) в hex.
// - Уже-hex значения автоматически пропускаются (не попадают в $in).
//
// Запуск:
//   DB_URL="mongodb+srv://..." node src/scripts/migrateStatusColorsToHex.js

import mongoose from "mongoose";
import BookingStatus from "../models/BookingStatus.js";

const NAMED_TO_HEX = {
  blue: "#3B82F6",
  green: "#10B981",
  red: "#EF4444",
  yellow: "#F59E0B",
  purple: "#8B5CF6",
  orange: "#F97316",
  gray: "#94A3B8",
  teal: "#06B6D4",
};

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/myDatabase";

const run = async () => {
  await mongoose.connect(DB_URL);
  console.log("Connected to MongoDB");

  const namedKeys = Object.keys(NAMED_TO_HEX);
  const docs = await BookingStatus.find({ color: { $in: namedKeys } }).select("_id color");

  console.log(`Found ${docs.length} statuses with named colors`);

  let updated = 0;
  for (const doc of docs) {
    const hex = NAMED_TO_HEX[doc.color];
    if (!hex) {
      console.log(`  Skip ${doc._id}: unknown color "${doc.color}"`);
      continue;
    }
    await BookingStatus.updateOne(
      { _id: doc._id },
      { $set: { color: hex } },
    );
    updated++;
  }

  const remainingNamed = await BookingStatus.countDocuments({
    color: { $in: namedKeys },
  });
  const totalHex = await BookingStatus.countDocuments({
    color: { $regex: /^#[0-9a-fA-F]{6}$/ },
  });
  const totalAll = await BookingStatus.countDocuments({});

  console.log(`Updated: ${updated}`);
  console.log(`Remaining named: ${remainingNamed}`);
  console.log(`Hex total: ${totalHex}`);
  console.log(`All statuses: ${totalAll}`);

  await mongoose.disconnect();
  console.log("Migration complete");
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
