import mongoose from 'mongoose';
import * as playgroundRepository from '../repository/playground.js';
import * as eventRepository from '../repository/event.js';
import * as playgroundCheckInRepository from '../repository/playgroundCheckIn.js';
import * as ratingRepository from '../repository/rating.js';
import { Sport } from '../models/Sport.js';
import { toDTO } from '../dto/playgroundDto.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';
import { reverseGeocode } from './geocoderService.js';
import { isAdmin } from '../utils/auth/admin.js';
import {
  uploadAsset,
  deleteAssetByUrl,
  ASSET_TYPES,
} from '../modules/media/index.js';

const MODERATED_PATCH_FIELDS = ['name', 'description', 'address', 'lat', 'lng'];

const isOwnerOf = (playground, user) => {
  if (!user?.id || !playground?.createdBy) return false;
  return String(playground.createdBy) === String(user.id);
};

const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 2000;
const UPCOMING_WINDOW_MS = 48 * 60 * 60 * 1000;

const toPlaygroundDTO = (doc, extras) => toDTO({ ...doc, _id: doc._id }, extras);

const computeCountersForIds = async (playgroundIds, now = new Date()) => {
  if (!Array.isArray(playgroundIds) || playgroundIds.length === 0) {
    return new Map();
  }
  const toDate = new Date(now.getTime() + UPCOMING_WINDOW_MS);
  const [checkInsMap, eventsMap] = await Promise.all([
    playgroundCheckInRepository.countActiveByPlaygroundIds(playgroundIds, now),
    eventRepository.countActiveByPlaygroundIds({
      playgroundIds,
      fromDate: now,
      toDate,
    }),
  ]);
  const result = new Map();
  playgroundIds.forEach((id) => {
    const key = id.toString();
    result.set(key, {
      activeCheckIns: checkInsMap.get(key) ?? 0,
      upcomingEvents: eventsMap.get(key) ?? 0,
    });
  });
  return result;
};

const computeRatingsForIds = async (playgroundIds) => {
  if (!Array.isArray(playgroundIds) || playgroundIds.length === 0) return new Map();
  return ratingRepository.getAggregateMap({
    targetType: 'playground',
    targetIds: playgroundIds,
  });
};

const computeRatingForOne = async (playgroundId) =>
  ratingRepository.getAggregate({ targetType: 'playground', targetId: playgroundId });

const emptyRating = () => ({ average: null, count: 0 });

const computeCountersForOne = async (playgroundId, now = new Date()) => {
  const toDate = new Date(now.getTime() + UPCOMING_WINDOW_MS);
  const [activeCheckIns, upcomingEvents] = await Promise.all([
    playgroundCheckInRepository.countActiveByPlayground(playgroundId, now),
    eventRepository.countActiveByPlayground({
      playgroundId,
      fromDate: now,
      toDate,
    }),
  ]);
  return { activeCheckIns, upcomingEvents };
};

const computeViewerForOne = async (
  playgroundId,
  authUser,
  playgroundDoc,
  now = new Date()
) => {
  if (!authUser?.id) return null;
  const isCheckedInHere = await playgroundCheckInRepository.isUserCheckedInOnPlayground(
    { userId: authUser.id, playgroundId },
    now
  );
  return {
    isCheckedInHere,
    isOwner: isOwnerOf(playgroundDoc, authUser),
  };
};

const isValidLng = (value) => typeof value === 'number' && value >= -180 && value <= 180;
const isValidLat = (value) => typeof value === 'number' && value >= -90 && value <= 90;

/**
 * @param {string} raw  "swLng,swLat,neLng,neLat"
 * @returns {{ swLng: number, swLat: number, neLng: number, neLat: number }}
 */
const parseBbox = (raw) => {
  if (!raw || typeof raw !== 'string') {
    throw new DomainError('bbox is required (swLng,swLat,neLng,neLat)', httpStatus.BAD_REQUEST);
  }
  const parts = raw.split(',').map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    throw new DomainError('bbox must be 4 comma-separated numbers', httpStatus.BAD_REQUEST);
  }
  const [swLng, swLat, neLng, neLat] = parts;
  if (!isValidLng(swLng) || !isValidLng(neLng) || !isValidLat(swLat) || !isValidLat(neLat)) {
    throw new DomainError('bbox values out of range', httpStatus.BAD_REQUEST);
  }
  if (swLat > neLat || swLng > neLng) {
    throw new DomainError('bbox SW corner must be south-west of NE corner', httpStatus.BAD_REQUEST);
  }
  return { swLng, swLat, neLng, neLat };
};

/**
 * @param {string | undefined} raw  "basketball,workout"
 * @returns {string[] | undefined}
 */
const parseSports = (raw) => {
  if (!raw || typeof raw !== 'string') return undefined;
  const codes = raw.split(',').map((code) => code.trim()).filter(Boolean);
  return codes.length > 0 ? codes : undefined;
};

const parseLimit = (raw) => {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_LIMIT;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
};

const lookupSportIdsByCodes = async (codes) => {
  if (!Array.isArray(codes) || codes.length === 0) return undefined;
  const docs = await Sport.find({ code: { $in: codes } }, { _id: 1 }).lean().exec();
  return docs.map((doc) => doc._id);
};

const isObjectIdLike = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

const resolveSportIds = async (sportsInput) => {
  if (!Array.isArray(sportsInput) || sportsInput.length === 0) return [];
  const ids = sportsInput.filter(isObjectIdLike).map((value) => new mongoose.Types.ObjectId(value));
  const codes = sportsInput.filter((value) => !isObjectIdLike(value));
  if (codes.length === 0) return ids;
  const codeIds = await lookupSportIdsByCodes(codes);
  return [...ids, ...(codeIds ?? [])];
};

/**
 * @param {{ bbox?: string, sports?: string, limit?: string }} query
 * @param {{ id: string } | undefined} [authUser]
 * @returns {Promise<{ items: object[], total: number, limit: number, hasMore: boolean }>}
 */
export async function listByBbox(query, authUser) {
  const bbox = parseBbox(query.bbox);
  const sportCodes = parseSports(query.sports);
  const limit = parseLimit(query.limit);
  const sportIds = await lookupSportIdsByCodes(sportCodes);
  const result = await playgroundRepository.findByBbox({ bbox, sportIds, limit });

  const now = new Date();
  const ids = result.items.map((doc) => doc._id);
  const [counters, ratings] = await Promise.all([
    computeCountersForIds(ids, now),
    computeRatingsForIds(ids),
  ]);

  return {
    items: result.items.map((doc) =>
      toPlaygroundDTO(doc, {
        counters: counters.get(doc._id.toString()) ?? {
          activeCheckIns: 0,
          upcomingEvents: 0,
        },
        rating: ratings.get(doc._id.toString()) ?? emptyRating(),
      })
    ),
    total: result.total,
    limit: result.limit,
    hasMore: result.items.length < result.total,
  };
}

/**
 * @param {string} id
 * @param {{ id: string } | undefined} [authUser]
 */
export async function getById(id, authUser) {
  if (!id) {
    throw new DomainError('id is required', httpStatus.BAD_REQUEST);
  }
  const doc = await playgroundRepository.findById(id);
  if (!doc) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  const now = new Date();
  const [counters, viewer, rating] = await Promise.all([
    computeCountersForOne(id, now),
    computeViewerForOne(id, authUser, doc, now),
    computeRatingForOne(id),
  ]);
  return toDTO(doc, { counters, viewer, rating });
}

const isValidLatLng = (lat, lng) => isValidLat(lat) && isValidLng(lng);

const buildLocation = (lat, lng) => ({ type: 'Point', coordinates: [lng, lat] });

const isEmptyAddress = (address) => {
  if (!address || typeof address !== 'object') return true;
  return !address.city && !address.district && !address.street && !address.fullAddress;
};

const resolveAddress = async (address, lat, lng) => {
  if (!isEmptyAddress(address)) return address;
  const geocoded = await reverseGeocode(lat, lng);
  return geocoded ?? {};
};

/**
 * @param {string | null} userId
 * @param {object} body
 */
export async function createPlayground(userId, body) {
  const { name, description, lat, lng, address, sports, photos } = body;
  if (!isValidLatLng(lat, lng)) {
    throw new DomainError('valid lat and lng are required', httpStatus.BAD_REQUEST);
  }
  const [sportIds, resolvedAddress] = await Promise.all([
    resolveSportIds(sports),
    resolveAddress(address, lat, lng),
  ]);
  const data = {
    name: name ?? null,
    description: description ?? null,
    location: buildLocation(lat, lng),
    address: resolvedAddress,
    sports: sportIds,
    photos: Array.isArray(photos) ? photos : [],
    createdBy: userId ?? null,
  };
  const doc = await playgroundRepository.create(data);
  await doc.populate('sports');
  return toDTO(doc);
}

const hasField = (body, key) =>
  body && Object.prototype.hasOwnProperty.call(body, key);

const buildUpdatePatch = async (body) => {
  const patch = {};
  if (hasField(body, 'name')) {
    patch.name = body.name == null ? null : String(body.name);
  }
  if (hasField(body, 'description')) {
    patch.description = body.description == null ? null : String(body.description);
  }
  if (hasField(body, 'address')) {
    patch.address = {
      city: body.address?.city ?? null,
      district: body.address?.district ?? null,
      street: body.address?.street ?? null,
      fullAddress: body.address?.fullAddress ?? null,
    };
  }
  if (hasField(body, 'lat') || hasField(body, 'lng')) {
    if (!isValidLatLng(body.lat, body.lng)) {
      throw new DomainError('valid lat and lng are required', httpStatus.BAD_REQUEST);
    }
    patch.location = buildLocation(body.lat, body.lng);
  }
  if (hasField(body, 'sports')) {
    patch.sports = await resolveSportIds(body.sports);
  }
  if (hasField(body, 'photos') && Array.isArray(body.photos)) {
    patch.photos = body.photos.filter((value) => typeof value === 'string');
  }
  return patch;
};

const hasModeratedField = (body) =>
  MODERATED_PATCH_FIELDS.some((key) =>
    Object.prototype.hasOwnProperty.call(body, key)
  );

/**
 * @param {string} id
 * @param {object} body
 * @param {{ id: string } | undefined} [authUser]
 */
export async function updatePlayground(id, body, authUser) {
  if (!id) {
    throw new DomainError('id is required', httpStatus.BAD_REQUEST);
  }
  const existing = await playgroundRepository.findById(id);
  if (!existing) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  const isEffective = isOwnerOf(existing, authUser) || isAdmin(authUser);
  if (!isEffective && hasModeratedField(body ?? {})) {
    throw new DomainError(
      'Foreign moderated edits must be submitted via edit-requests',
      httpStatus.FORBIDDEN
    );
  }
  const patch = await buildUpdatePatch(body ?? {});
  if (Object.keys(patch).length === 0) {
    throw new DomainError('Nothing to update', httpStatus.BAD_REQUEST);
  }
  const doc = await playgroundRepository.updateById(id, patch);
  if (!doc) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  return toDTO(doc);
}

/**
 * Загрузить фото в активное хранилище и привязать URL к площадке.
 * @param {string} id
 * @param {{ buffer: Buffer, mimetype: string, size: number, originalname: string }} file
 */
export async function addPhotoToPlayground(id, file) {
  if (!id) {
    throw new DomainError('id is required', httpStatus.BAD_REQUEST);
  }
  if (!file) {
    throw new DomainError('file is required', httpStatus.BAD_REQUEST);
  }
  const existing = await playgroundRepository.findById(id);
  if (!existing) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  const { url } = await uploadAsset({
    assetType: ASSET_TYPES.PLAYGROUND_PHOTO,
    ownerId: id,
    file,
  });
  const updated = await playgroundRepository.addPhoto(id, url);
  return toDTO(updated);
}

/**
 * Удалить фото у площадки и попытаться удалить файл в провайдере.
 * Удалять может только владелец площадки или админ.
 * @param {string} id
 * @param {string} url
 * @param {{ id: string } | undefined} [authUser]
 */
export async function removePhotoFromPlayground(id, url, authUser) {
  if (!id) {
    throw new DomainError('id is required', httpStatus.BAD_REQUEST);
  }
  if (!url || typeof url !== 'string') {
    throw new DomainError('url is required', httpStatus.BAD_REQUEST);
  }
  const existing = await playgroundRepository.findById(id);
  if (!existing) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  const allowed = isOwnerOf(existing, authUser) || isAdmin(authUser);
  if (!allowed) {
    throw new DomainError(
      'Only the playground owner or an admin can delete photos',
      httpStatus.FORBIDDEN
    );
  }
  const updated = await playgroundRepository.removePhoto(id, url);
  if (!updated) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  await deleteAssetByUrl(url);
  return toDTO(updated);
}
