// src/modules/media/constants/media.js

/**
 * Типы ассетов, которые мы умеем загружать.
 * Используется для выбора папки в провайдере и резолва лимитов.
 */
export const ASSET_TYPES = Object.freeze({
  USER_AVATAR: "user-avatar",
  STAFF_AVATAR: "staff-avatar",
  ORG_LOGO: "org-logo",
  SERVICE_PHOTO: "service-photo",
});

const ALLOWED_MIMES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const AVATAR_LIMITS = Object.freeze({
  maxBytes: 2 * 1024 * 1024,
  mimes: ALLOWED_MIMES,
});

const LARGE_IMAGE_LIMITS = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  mimes: ALLOWED_MIMES,
});

/**
 * Лимиты по типу ассета — централизованно, чтобы для разных сущностей
 * (аватарки / лого орг / фото услуг) ставить разные ограничения.
 */
export const ASSET_LIMITS = Object.freeze({
  [ASSET_TYPES.USER_AVATAR]: AVATAR_LIMITS,
  [ASSET_TYPES.STAFF_AVATAR]: AVATAR_LIMITS,
  [ASSET_TYPES.ORG_LOGO]: LARGE_IMAGE_LIMITS,
  [ASSET_TYPES.SERVICE_PHOTO]: LARGE_IMAGE_LIMITS,
});

/**
 * Резолвит лимиты по assetType. Бросает если тип неизвестен —
 * лучше упасть громко, чем тихо принять что-то странное.
 */
export const getAssetLimits = (assetType) => {
  const limits = ASSET_LIMITS[assetType];
  if (!limits) {
    throw new Error(`Unknown assetType: ${assetType}`);
  }
  return limits;
};
