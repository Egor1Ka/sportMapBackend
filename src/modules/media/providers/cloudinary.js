// src/modules/media/providers/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import { ASSET_TYPES } from "../constants/media.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Папки в Cloudinary детерминистичны от ownerId, чтобы повторный аплоад
 * перезаписывал старый файл (overwrite: true) и нам не нужно было хранить
 * provider_id в БД.
 */
const buildPublicId = (assetType, ownerId) => {
  if (assetType === ASSET_TYPES.USER_AVATAR) {
    return `slotix/avatars/users/${ownerId}`;
  }
  if (assetType === ASSET_TYPES.STAFF_AVATAR) {
    return `slotix/avatars/staff/${ownerId}`;
  }
  if (assetType === ASSET_TYPES.ORG_LOGO) {
    return `slotix/orgs/${ownerId}/logo`;
  }
  if (assetType === ASSET_TYPES.SERVICE_PHOTO) {
    return `slotix/services/${ownerId}`;
  }
  throw new Error(`Unknown assetType for publicId: ${assetType}`);
};

/**
 * Трансформации по типу ассета. Аватарки кропятся по лицу (g_face),
 * лого и фото услуг — по умному контент-aware кропу (g_auto).
 */
const TRANSFORMATIONS = Object.freeze({
  [ASSET_TYPES.USER_AVATAR]: [
    { width: 400, height: 400, crop: "fill", gravity: "face" },
    { quality: "auto", fetch_format: "auto" },
  ],
  [ASSET_TYPES.STAFF_AVATAR]: [
    { width: 400, height: 400, crop: "fill", gravity: "face" },
    { quality: "auto", fetch_format: "auto" },
  ],
  [ASSET_TYPES.ORG_LOGO]: [
    { width: 400, height: 400, crop: "fill", gravity: "auto" },
    { quality: "auto", fetch_format: "auto" },
  ],
  [ASSET_TYPES.SERVICE_PHOTO]: [
    { width: 400, height: 400, crop: "fill", gravity: "auto" },
    { quality: "auto", fetch_format: "auto" },
  ],
});

const OG_TRANSFORMATION = [
  { width: 1200, height: 630, crop: "fill", gravity: "auto" },
  { quality: "auto", fetch_format: "auto" },
];

const getOgImageUrl = (assetType, ownerId) => {
  const publicId = buildPublicId(assetType, ownerId);
  return cloudinary.url(publicId, {
    secure: true,
    transformation: OG_TRANSFORMATION,
  });
};

const uploadStream = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });

/**
 * Залить файл в Cloudinary. Возвращает URL уже с трансформациями.
 */
const upload = async (file, { assetType, ownerId }) => {
  const publicId = buildPublicId(assetType, ownerId);
  const result = await uploadStream(file.buffer, {
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
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

const buildProviderId = (assetType, ownerId) => buildPublicId(assetType, ownerId);

export default { upload, delete: remove, buildProviderId, getOgImageUrl };
