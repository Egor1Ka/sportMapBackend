import { Playground } from '../models/Playground.js';

/**
 * @typedef {{ swLng: number, swLat: number, neLng: number, neLat: number }} BboxQuery
 */

const buildBboxPolygon = ({ swLng, swLat, neLng, neLat }) => ({
  type: 'Polygon',
  coordinates: [
    [
      [swLng, swLat],
      [neLng, swLat],
      [neLng, neLat],
      [swLng, neLat],
      [swLng, swLat],
    ],
  ],
});

const buildSportsFilter = (sportIds) =>
  Array.isArray(sportIds) && sportIds.length > 0 ? { sports: { $in: sportIds } } : {};

/**
 * @param {{ bbox: BboxQuery, sportIds?: import('mongoose').Types.ObjectId[], limit?: number }} params
 * @returns {Promise<{ items: import('mongoose').Document[], total: number, limit: number }>}
 */
export async function findByBbox({ bbox, sportIds, limit = 2000 }) {
  const filter = {
    location: { $geoIntersects: { $geometry: buildBboxPolygon(bbox) } },
    ...buildSportsFilter(sportIds),
  };
  const cappedLimit = Math.min(Math.max(limit, 1), 5000);
  const [items, total] = await Promise.all([
    Playground.find(filter).populate('sports').limit(cappedLimit).lean().exec(),
    Playground.countDocuments(filter).exec(),
  ]);
  return { items, total, limit: cappedLimit };
}

/**
 * @param {string} id
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findById(id) {
  return Playground.findById(id).populate('sports').lean().exec();
}

/**
 * @param {object} data
 * @returns {Promise<import('mongoose').Document>}
 */
export function create(data) {
  return Playground.create(data);
}

/**
 * Частичный апдейт. Возвращает обновлённый документ с populated sports.
 * @param {string} id
 * @param {object} patch
 */
export function updateById(id, patch) {
  return Playground.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  })
    .populate('sports')
    .lean()
    .exec();
}

/**
 * Добавить URL фото к массиву photos.
 * @param {string} id
 * @param {string} url
 */
export function addPhoto(id, url) {
  return Playground.findByIdAndUpdate(
    id,
    { $push: { photos: url } },
    { new: true }
  )
    .populate('sports')
    .lean()
    .exec();
}

/**
 * Удалить URL фото из массива photos.
 * @param {string} id
 * @param {string} url
 */
export function removePhoto(id, url) {
  return Playground.findByIdAndUpdate(
    id,
    { $pull: { photos: url } },
    { new: true }
  )
    .populate('sports')
    .lean()
    .exec();
}
