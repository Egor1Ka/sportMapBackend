import 'dotenv/config';
import mongoose from 'mongoose';
import { Playground } from '../src/models/Playground.js';
import { connectDB } from '../src/db.js';
import { reverseGeocode } from '../src/services/geocoderService.js';

const THROTTLE_MS = 1100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const findPending = () =>
  Playground.find({
    location: { $exists: true },
    $or: [
      { 'address.fullAddress': null },
      { 'address.fullAddress': { $exists: false } },
    ],
  })
    .select({ _id: 1, location: 1 })
    .lean()
    .exec();

const extractLatLng = (doc) => {
  const coords = doc.location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
};

const processOne = async (doc, index, total) => {
  const point = extractLatLng(doc);
  if (!point) {
    console.log(`[${index}/${total}] skip — invalid coords`);
    return;
  }
  const address = await reverseGeocode(point.lat, point.lng);
  if (!address) {
    console.log(`[${index}/${total}] no result for ${point.lat},${point.lng}`);
    return;
  }
  await Playground.updateOne({ _id: doc._id }, { $set: { address } }).exec();
  const summary = address.fullAddress ? address.fullAddress.slice(0, 80) : '(empty)';
  console.log(`[${index}/${total}] ${summary}`);
};

const run = async () => {
  await connectDB();
  console.log('Connected to MongoDB');

  const pending = await findPending();
  console.log(`Found ${pending.length} playgrounds without address`);

  if (pending.length === 0) {
    console.log('Nothing to geocode.');
    return;
  }

  const estimatedMinutes = ((pending.length * THROTTLE_MS) / 60000).toFixed(1);
  console.log(`Throttle: ${THROTTLE_MS}ms per request → ~${estimatedMinutes} min total`);

  const total = pending.length;
  const buildStep = (totalCount) => (chain, doc, index) => {
    const isLast = index === totalCount - 1;
    return chain
      .then(() => processOne(doc, index + 1, totalCount))
      .then(() => (isLast ? null : sleep(THROTTLE_MS)));
  };
  await pending.reduce(buildStep(total), Promise.resolve());

  console.log('Backfill done.');
};

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
