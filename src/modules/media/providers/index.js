// src/modules/media/providers/index.js
import cloudinary from "./cloudinary.js";

export const PROVIDERS = Object.freeze({
  cloudinary,
});

/**
 * Активный провайдер — выбирается через env. Дефолт cloudinary.
 * Когда добавим S3 / R2 — просто меняем env.
 */
export const getActiveProvider = () => {
  const name = process.env.MEDIA_PROVIDER || "cloudinary";
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown MEDIA_PROVIDER: ${name}`);
  }
  return provider;
};
