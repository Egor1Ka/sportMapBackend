// src/modules/media/services/mediaServices.js
import { getActiveProvider } from "../providers/index.js";
import { getAssetLimits } from "../constants/media.js";

/**
 * Залить аватарку. Сервис не знает про конкретного провайдера.
 *
 * @param {Object} params
 * @param {'user-avatar'|'staff-avatar'} params.assetType
 * @param {string} params.ownerId  — для user-avatar = userId, для staff-avatar = `${orgId}/${staffId}`
 * @param {{ buffer: Buffer, mimetype: string, size: number, originalname: string }} params.file
 * @returns {Promise<{ url: string, providerId: string }>}
 */
export const uploadAvatar = async ({ assetType, ownerId, file }) => {
  if (!file || !file.buffer) {
    throw new Error("uploadAvatar: file.buffer required");
  }
  const limits = getAssetLimits(assetType);
  if (!limits.mimes.includes(file.mimetype)) {
    const err = new Error(`Mime ${file.mimetype} not allowed`);
    err.code = "INVALID_MIME";
    throw err;
  }
  if (file.size > limits.maxBytes) {
    const err = new Error(`File size ${file.size} exceeds ${limits.maxBytes}`);
    err.code = "FILE_TOO_LARGE";
    throw err;
  }

  const provider = getActiveProvider();
  return provider.upload(file, { assetType, ownerId });
};

/**
 * Построить URL OG-картинки 1200×630 для ассета.
 * Provider-agnostic — работает поверх Cloudinary, S3 (когда добавим), и т.д.
 */
export const getOgImageUrl = (assetType, ownerId) =>
  getActiveProvider().getOgImageUrl(assetType, ownerId);

/**
 * Удалить аватарку из хранилища. Идемпотентно — если файла нет, не падаем.
 */
export const deleteAvatar = async ({ assetType, ownerId }) => {
  const provider = getActiveProvider();
  const providerId = provider.buildProviderId(assetType, ownerId);
  try {
    await provider.delete(providerId);
  } catch (err) {
    // не критично если файла уже нет — главное, чтобы поле в БД зачистилось выше
    if (err && err.http_code !== 404) {
      throw err;
    }
  }
};
