import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { ASSET_TYPES } from '../constants/media.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * USER_AVATAR — детерминированный publicId (overwrite на повторном аплоаде).
 * PLAYGROUND_PHOTO — каждый аплоад уникален: у площадки может быть несколько фото.
 */
const buildPublicId = ({ assetType, ownerId, fileId }) => {
  if (assetType === ASSET_TYPES.USER_AVATAR) {
    return `sportmap/avatars/users/${ownerId}`;
  }
  if (assetType === ASSET_TYPES.PLAYGROUND_PHOTO) {
    return `sportmap/playgrounds/${ownerId}/${fileId ?? randomUUID()}`;
  }
  throw new Error(`Unknown assetType for publicId: ${assetType}`);
};

const TRANSFORMATIONS = Object.freeze({
  [ASSET_TYPES.USER_AVATAR]: [
    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
    { quality: 'auto', fetch_format: 'auto' },
  ],
  [ASSET_TYPES.PLAYGROUND_PHOTO]: [
    { width: 1600, height: 1000, crop: 'limit' },
    { quality: 'auto', fetch_format: 'auto' },
  ],
});

const OVERWRITE_BY_TYPE = Object.freeze({
  [ASSET_TYPES.USER_AVATAR]: true,
  [ASSET_TYPES.PLAYGROUND_PHOTO]: false,
});

const uploadStream = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });

/**
 * Залить файл в Cloudinary. Возвращает URL с трансформациями и providerId.
 */
const upload = async (file, { assetType, ownerId }) => {
  const publicId = buildPublicId({ assetType, ownerId });
  const result = await uploadStream(file.buffer, {
    public_id: publicId,
    overwrite: OVERWRITE_BY_TYPE[assetType] ?? false,
    resource_type: 'image',
    invalidate: true,
  });

  const url = cloudinary.url(result.public_id, {
    secure: true,
    version: result.version,
    transformation: TRANSFORMATIONS[assetType],
  });

  return { url, providerId: result.public_id };
};

const remove = async (providerId) => {
  await cloudinary.uploader.destroy(providerId, { invalidate: true });
};

/**
 * Достать publicId из Cloudinary URL.
 * https://res.cloudinary.com/{cloud}/image/upload/[transformations/]v{ver}/{publicId}.{ext}
 */
const extractProviderId = (url) => {
  if (typeof url !== 'string') return null;
  const match = url.match(/\/upload\/(?:[^/]+\/)*v\d+\/(.+)\.[^./]+$/);
  return match ? match[1] : null;
};

export default { upload, delete: remove, extractProviderId };
