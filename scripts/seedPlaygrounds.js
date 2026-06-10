import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { Playground } from '../src/models/Playground.js';
import { Sport } from '../src/models/Sport.js';
import { connectDB } from '../src/db.js';

const DEFAULT_FILE = '/Users/egorzozula/Desktop/sportMap/Template-frontend/public/data/dnipro-sports.json';

const pickName = (tags) => tags?.name ?? tags?.['name:uk'] ?? tags?.['name:en'] ?? null;

const splitSportCodes = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const extractCoords = (element) => {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) return element.center;
  return null;
};

const buildPhotos = (tags) => {
  const photo = tags?.image;
  return typeof photo === 'string' && photo.length > 0 ? [photo] : [];
};

const buildAddress = (tags) => ({
  city: tags?.['addr:city'] ?? null,
  district: tags?.['addr:suburb'] ?? null,
  street: tags?.['addr:street'] ?? null,
  fullAddress: tags?.['addr:full'] ?? null,
});

const collectUniqueCodes = (elements) => {
  const codes = new Set();
  elements.forEach((element) => {
    splitSportCodes(element.tags?.sport).forEach((code) => codes.add(code));
  });
  return [...codes];
};

const ensureSports = async (codes) => {
  if (codes.length === 0) return new Map();
  const ops = codes.map((code) => ({
    updateOne: {
      filter: { code },
      update: { $setOnInsert: { code, label: code } },
      upsert: true,
    },
  }));
  await Sport.bulkWrite(ops);
  const docs = await Sport.find({ code: { $in: codes } }, { _id: 1, code: 1 }).lean().exec();
  return new Map(docs.map((doc) => [doc.code, doc._id]));
};

const buildPlaygroundDoc = (codeToId) => (element) => {
  const coords = extractCoords(element);
  if (!coords) return null;
  const tags = element.tags ?? {};
  const sportIds = splitSportCodes(tags.sport)
    .map((code) => codeToId.get(code))
    .filter(Boolean);
  return {
    name: pickName(tags),
    description: tags.description ?? null,
    location: { type: 'Point', coordinates: [coords.lon, coords.lat] },
    address: buildAddress(tags),
    sports: sportIds,
    photos: buildPhotos(tags),
    createdBy: null,
  };
};

const isDoc = (value) => value !== null;

const seed = async (filePath) => {
  await connectDB();
  console.log('Connected to MongoDB');

  const raw = await readFile(resolve(filePath), 'utf-8');
  const parsed = JSON.parse(raw);
  const elements = Array.isArray(parsed.elements) ? parsed.elements : [];
  console.log(`Loaded ${elements.length} raw elements from ${filePath}`);

  const uniqueCodes = collectUniqueCodes(elements);
  console.log(`Found ${uniqueCodes.length} unique sport codes`);

  const codeToId = await ensureSports(uniqueCodes);
  console.log(`Resolved ${codeToId.size} sport ids`);

  const docs = elements.map(buildPlaygroundDoc(codeToId)).filter(isDoc);
  console.log(`Mapped to ${docs.length} valid playgrounds`);

  if (docs.length === 0) {
    console.log('Nothing to insert.');
    return;
  }

  const removed = await Playground.deleteMany({}).exec();
  console.log(`Removed ${removed.deletedCount} existing playgrounds`);

  const inserted = await Playground.insertMany(docs);
  console.log(`Inserted ${inserted.length} playgrounds`);
};

const filePath = process.argv[2] ?? DEFAULT_FILE;

seed(filePath)
  .then(() => mongoose.disconnect())
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
