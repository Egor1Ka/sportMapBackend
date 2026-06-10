import mongoose from 'mongoose';
import * as playgroundRepository from '../repository/playground.js';
import * as playgroundEditRequestRepository from '../repository/playgroundEditRequest.js';
import { toDTO as toPlaygroundDTO } from '../dto/playgroundDto.js';
import { toDTO as toRequestDTO } from '../dto/playgroundEditRequestDto.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';
import { isAdmin } from '../utils/auth/admin.js';

const PLAYGROUND_DTO_DEFAULTS = {
  counters: { activeCheckIns: 0, upcomingEvents: 0 },
  rating: { average: null, count: 0 },
};

const isValidLat = (value) => typeof value === 'number' && value >= -90 && value <= 90;
const isValidLng = (value) => typeof value === 'number' && value >= -180 && value <= 180;

const buildLocation = (lat, lng) => ({ type: 'Point', coordinates: [lng, lat] });

const normalizeString = (value) => {
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const ADDRESS_KEYS = ['city', 'district', 'street', 'fullAddress'];

const sanitizeAddressDiff = (input) => {
  if (!input || typeof input !== 'object') return undefined;
  const collect = (acc, key) => {
    if (!Object.prototype.hasOwnProperty.call(input, key)) return acc;
    const value = input[key];
    if (value !== null && typeof value !== 'string') return acc;
    return { ...acc, [key]: normalizeString(value) };
  };
  const result = ADDRESS_KEYS.reduce(collect, {});
  return Object.keys(result).length === 0 ? undefined : result;
};

/**
 * Strip the diff down to allowed moderated fields and validated values.
 * Throws DomainError when nothing remains.
 */
const sanitizeDiff = (raw) => {
  if (!raw || typeof raw !== 'object') {
    throw new DomainError('diff is required', httpStatus.BAD_REQUEST);
  }
  const result = {};
  if (Object.prototype.hasOwnProperty.call(raw, 'name')) {
    if (raw.name !== null && typeof raw.name !== 'string') {
      throw new DomainError('diff.name must be string or null', httpStatus.BAD_REQUEST);
    }
    result.name = normalizeString(raw.name);
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'description')) {
    if (raw.description !== null && typeof raw.description !== 'string') {
      throw new DomainError('diff.description must be string or null', httpStatus.BAD_REQUEST);
    }
    result.description = normalizeString(raw.description);
  }
  const address = sanitizeAddressDiff(raw.address);
  if (address) result.address = address;
  if (Object.prototype.hasOwnProperty.call(raw, 'lat')) {
    if (!isValidLat(raw.lat)) {
      throw new DomainError('diff.lat is out of range', httpStatus.BAD_REQUEST);
    }
    result.lat = raw.lat;
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'lng')) {
    if (!isValidLng(raw.lng)) {
      throw new DomainError('diff.lng is out of range', httpStatus.BAD_REQUEST);
    }
    result.lng = raw.lng;
  }
  if (Object.keys(result).length === 0) {
    throw new DomainError('diff has no moderated fields', httpStatus.BAD_REQUEST);
  }
  return result;
};

const stringEquals = (a, b) => normalizeString(a) === normalizeString(b);
const numberEquals = (a, b) => (a ?? null) === (b ?? null);

/**
 * Drop diff fields that already equal the current playground state.
 */
const stripUnchanged = (diff, playground) => {
  const result = {};
  if ('name' in diff && !stringEquals(diff.name, playground.name)) {
    result.name = diff.name;
  }
  if ('description' in diff && !stringEquals(diff.description, playground.description)) {
    result.description = diff.description;
  }
  if (diff.address) {
    const current = playground.address ?? {};
    const collect = (acc, key) => {
      if (!Object.prototype.hasOwnProperty.call(diff.address, key)) return acc;
      if (stringEquals(diff.address[key], current[key])) return acc;
      return { ...acc, [key]: diff.address[key] };
    };
    const addressResult = ADDRESS_KEYS.reduce(collect, {});
    if (Object.keys(addressResult).length > 0) result.address = addressResult;
  }
  if ('lat' in diff && !numberEquals(diff.lat, playground.lat)) {
    result.lat = diff.lat;
  }
  if ('lng' in diff && !numberEquals(diff.lng, playground.lng)) {
    result.lng = diff.lng;
  }
  return result;
};

const ensurePlayground = async (playgroundId) => {
  if (!playgroundId || !mongoose.Types.ObjectId.isValid(playgroundId)) {
    throw new DomainError('Invalid playground id', httpStatus.BAD_REQUEST);
  }
  const doc = await playgroundRepository.findById(playgroundId);
  if (!doc) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  return doc;
};

const isOwner = (playground, user) => {
  if (!user?.id || !playground?.createdBy) return false;
  return String(playground.createdBy) === String(user.id);
};

const playgroundDocToShape = (doc) => {
  const dto = toPlaygroundDTO(doc, PLAYGROUND_DTO_DEFAULTS);
  return dto;
};

/**
 * @param {string} playgroundId
 * @param {{ id: string }} authUser
 * @param {object} rawDiff
 */
export async function submitRequest(playgroundId, authUser, rawDiff) {
  if (!authUser?.id) {
    throw new DomainError('Authentication required', httpStatus.UNAUTHORIZED);
  }
  const playground = await ensurePlayground(playgroundId);
  if (isOwner(playground, authUser) || isAdmin(authUser)) {
    throw new DomainError(
      'Owners and admins should update the playground directly',
      httpStatus.BAD_REQUEST
    );
  }
  const sanitized = sanitizeDiff(rawDiff);
  const dtoPlayground = playgroundDocToShape(playground);
  const finalDiff = stripUnchanged(sanitized, dtoPlayground);
  if (Object.keys(finalDiff).length === 0) {
    throw new DomainError('Nothing to update', httpStatus.BAD_REQUEST);
  }
  const doc = await playgroundEditRequestRepository.create({
    playgroundId,
    authorId: authUser.id,
    diff: finalDiff,
  });
  return toRequestDTO(doc.toObject());
}

/**
 * @param {{ status?: string, limit?: number, skip?: number }} params
 */
export async function listRequests(params = {}) {
  const { status, limit, skip } = params;
  if (status && !['pending', 'approved', 'rejected'].includes(status)) {
    throw new DomainError('Invalid status filter', httpStatus.BAD_REQUEST);
  }
  const { items, total, limit: appliedLimit } =
    await playgroundEditRequestRepository.findMany({ status, limit, skip });

  const playgroundIds = [...new Set(items.map((req) => String(req.playgroundId)))];
  const playgroundDocs = await Promise.all(
    playgroundIds.map((id) => playgroundRepository.findById(id))
  );
  const playgroundMap = new Map(
    playgroundDocs
      .filter((doc) => doc !== null)
      .map((doc) => [doc._id.toString(), doc])
  );

  const pairs = items
    .map((req) => {
      const playgroundDoc = playgroundMap.get(String(req.playgroundId));
      if (!playgroundDoc) return null;
      return {
        request: toRequestDTO(req),
        playground: playgroundDocToShape(playgroundDoc),
      };
    })
    .filter((pair) => pair !== null);

  return { items: pairs, total, limit: appliedLimit };
}

export async function getRequestById(requestId) {
  if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
    throw new DomainError('Invalid request id', httpStatus.BAD_REQUEST);
  }
  const req = await playgroundEditRequestRepository.findById(requestId);
  if (!req) {
    throw new DomainError('Edit request not found', httpStatus.NOT_FOUND);
  }
  const playground = await playgroundRepository.findById(req.playgroundId);
  if (!playground) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  return {
    request: toRequestDTO(req),
    playground: playgroundDocToShape(playground),
  };
}

export async function getPendingCount() {
  const count = await playgroundEditRequestRepository.countByStatus('pending');
  return { count };
}

const buildPatchFromDiff = (diff, playground) => {
  const patch = {};
  if ('name' in diff) patch.name = diff.name;
  if ('description' in diff) patch.description = diff.description;
  if (diff.address) {
    patch.address = {
      ...(playground.address ?? {}),
      ...diff.address,
    };
  }
  if ('lat' in diff || 'lng' in diff) {
    const currentLat = playground.lat;
    const currentLng = playground.lng;
    const nextLat = 'lat' in diff ? diff.lat : currentLat;
    const nextLng = 'lng' in diff ? diff.lng : currentLng;
    if (!isValidLat(nextLat) || !isValidLng(nextLng)) {
      throw new DomainError('Invalid coordinates after applying diff', httpStatus.BAD_REQUEST);
    }
    patch.location = buildLocation(nextLat, nextLng);
  }
  return patch;
};

/**
 * @param {string} requestId
 * @param {{ id: string }} adminUser
 */
export async function approveRequest(requestId, adminUser) {
  if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
    throw new DomainError('Invalid request id', httpStatus.BAD_REQUEST);
  }
  const req = await playgroundEditRequestRepository.findByIdRaw(requestId);
  if (!req) {
    throw new DomainError('Edit request not found', httpStatus.NOT_FOUND);
  }
  if (req.status !== 'pending') {
    throw new DomainError(`Request already ${req.status}`, httpStatus.CONFLICT);
  }
  const playgroundDoc = await playgroundRepository.findById(req.playgroundId);
  if (!playgroundDoc) {
    await playgroundEditRequestRepository.resolveById(requestId, {
      status: 'rejected',
      resolvedBy: adminUser?.id,
    });
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  const currentShape = playgroundDocToShape(playgroundDoc);
  const diffPlain = req.toObject ? req.toObject().diff : req.diff;
  const finalDiff = stripUnchanged(diffPlain, currentShape);
  if (Object.keys(finalDiff).length === 0) {
    await playgroundEditRequestRepository.resolveById(requestId, {
      status: 'approved',
      resolvedBy: adminUser?.id,
    });
    return playgroundDocToShape(playgroundDoc);
  }
  const patch = buildPatchFromDiff(finalDiff, currentShape);
  const updatedDoc = await playgroundRepository.updateById(req.playgroundId, patch);
  await playgroundEditRequestRepository.resolveById(requestId, {
    status: 'approved',
    resolvedBy: adminUser?.id,
  });
  return playgroundDocToShape(updatedDoc);
}

/**
 * @param {string} requestId
 * @param {{ id: string }} adminUser
 */
export async function rejectRequest(requestId, adminUser) {
  if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
    throw new DomainError('Invalid request id', httpStatus.BAD_REQUEST);
  }
  const req = await playgroundEditRequestRepository.findByIdRaw(requestId);
  if (!req) {
    throw new DomainError('Edit request not found', httpStatus.NOT_FOUND);
  }
  if (req.status !== 'pending') {
    throw new DomainError(`Request already ${req.status}`, httpStatus.CONFLICT);
  }
  const updated = await playgroundEditRequestRepository.resolveById(requestId, {
    status: 'rejected',
    resolvedBy: adminUser?.id,
  });
  return toRequestDTO(updated);
}
