import mongoose from 'mongoose';

/**
 * Connect to MongoDB. Uses process.env.DB_URL.
 * @returns {Promise<void>}
 */
export async function connectDB() {
  const url = process.env.DB_URL;
  if (!url) {
    throw new Error('DB_URL is required');
  }
  await mongoose.connect(url);
}
