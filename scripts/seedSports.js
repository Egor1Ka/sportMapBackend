import 'dotenv/config';
import mongoose from 'mongoose';
import { Sport } from '../src/models/Sport.js';
import { connectDB } from '../src/db.js';
import { SPORTS_CATALOG } from './sportsCatalog.js';

const buildUpsertOp = (entry) => ({
  updateOne: {
    filter: { code: entry.code },
    update: { $set: entry },
    upsert: true,
  },
});

const seed = async () => {
  await connectDB();
  console.log('Connected to MongoDB');

  const ops = SPORTS_CATALOG.map(buildUpsertOp);
  const result = await Sport.bulkWrite(ops);

  console.log(
    `Upserted sports: matched=${result.matchedCount}, modified=${result.modifiedCount}, upserted=${result.upsertedCount}`
  );
};

seed()
  .then(() => mongoose.disconnect())
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
