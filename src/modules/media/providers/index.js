import cloudinary from './cloudinary.js';

export const PROVIDERS = Object.freeze({
  cloudinary,
});

export const getActiveProvider = () => {
  const name = process.env.MEDIA_PROVIDER || 'cloudinary';
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown MEDIA_PROVIDER: ${name}`);
  }
  return provider;
};
