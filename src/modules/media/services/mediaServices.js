import { getActiveProvider } from '../providers/index.js';
import { getAssetLimits } from '../constants/media.js';

/**
 * Залить ассет в активное хранилище. Сервис не знает про конкретного провайдера.
 *
 * @param {Object} params
 * @param {'user-avatar'|'playground-photo'} params.assetType
 * @param {string} params.ownerId — для user-avatar = userId, для playground-photo = playgroundId
 * @param {{ buffer: Buffer, mimetype: string, size: number, originalname: string }} params.file
 * @returns {Promise<{ url: string, providerId: string }>}
 */
export const uploadAsset = async ({ assetType, ownerId, file }) => {
  if (!file || !file.buffer) {
    throw new Error('uploadAsset: file.buffer required');
  }
  const limits = getAssetLimits(assetType);
  if (!limits.mimes.includes(file.mimetype)) {
    const err = new Error(`Mime ${file.mimetype} not allowed`);
    err.code = 'INVALID_MIME';
    throw err;
  }
  if (file.size > limits.maxBytes) {
    const err = new Error(`File size ${file.size} exceeds ${limits.maxBytes}`);
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  const provider = getActiveProvider();
  return provider.upload(file, { assetType, ownerId });
};

/**
 * Удалить ассет из хранилища. Идемпотентно — если файла нет, не падаем.
 */
export const deleteAsset = async (providerId) => {
  if (!providerId) return;
  const provider = getActiveProvider();
  try {
    await provider.delete(providerId);
  } catch (err) {
    if (err && err.http_code !== 404) {
      throw err;
    }
  }
};

/**
 * Удалить ассет по URL — провайдер сам достаёт свой providerId из URL.
 */
export const deleteAssetByUrl = async (url) => {
  if (!url) return;
  const provider = getActiveProvider();
  const providerId = provider.extractProviderId?.(url);
  if (!providerId) return;
  await deleteAsset(providerId);
};
