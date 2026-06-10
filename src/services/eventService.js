import mongoose from 'mongoose';
import * as eventRepository from '../repository/event.js';
import * as eventRsvpRepository from '../repository/eventRsvp.js';
import * as playgroundRepository from '../repository/playground.js';
import { Sport } from '../models/Sport.js';
import { toDTO, toRsvpResponse } from '../dto/eventDto.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';

const MIN_LEAD_MS = 5 * 60 * 1000;

const isValidObjectId = (value) =>
  typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const assertObjectId = (value, label) => {
  if (!isValidObjectId(value)) {
    throw new DomainError(`Invalid ${label}`, httpStatus.BAD_REQUEST);
  }
};

const assertAuth = (authUser) => {
  if (!authUser || !authUser.id) {
    throw new DomainError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
};

const parseStartAt = (raw) => {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new DomainError(
      'startAt is required (ISO datetime)',
      httpStatus.BAD_REQUEST
    );
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError(
      'startAt must be a valid ISO datetime',
      httpStatus.BAD_REQUEST
    );
  }
  return date;
};

const assertStartInWindow = (start, now = new Date()) => {
  const diff = start.getTime() - now.getTime();
  if (diff < MIN_LEAD_MS) {
    throw new DomainError(
      'Time must be at least 5 minutes from now',
      httpStatus.BAD_REQUEST,
      { code: 'eventTimeOutOfWindow' }
    );
  }
};

const parseDuration = (raw) => {
  if (raw === undefined || raw === null) return 60;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 15 || value > 480) {
    throw new DomainError(
      'durationMin must be between 15 and 480',
      httpStatus.BAD_REQUEST
    );
  }
  return value;
};

const parseMaxParticipants = (raw) => {
  if (raw === undefined || raw === null) return null;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 2 || value > 100) {
    throw new DomainError(
      'maxParticipants must be between 2 and 100',
      httpStatus.BAD_REQUEST
    );
  }
  return value;
};

const parseDescription = (raw) => {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw new DomainError('description must be a string', httpStatus.BAD_REQUEST);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 280) {
    throw new DomainError(
      'description must be at most 280 characters',
      httpStatus.BAD_REQUEST
    );
  }
  return trimmed;
};

const assertSportExists = async (sportId) => {
  assertObjectId(sportId, 'sportId');
  const sport = await Sport.findById(sportId).lean().exec();
  if (!sport) {
    throw new DomainError('Sport not found', httpStatus.BAD_REQUEST);
  }
};

const assertPlaygroundExists = async (playgroundId) => {
  const playground = await playgroundRepository.findById(playgroundId);
  if (!playground) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
};

const buildViewerFlag = async (eventId, userId) => {
  if (!userId) return undefined;
  const rsvp = await eventRsvpRepository.findOne({ eventId, userId });
  return { isRsvped: !!rsvp };
};

const hydrateEventDTO = async (doc, authUser, now = new Date()) => {
  const [rsvpCount, viewer] = await Promise.all([
    eventRsvpRepository.countByEvent(doc._id),
    buildViewerFlag(doc._id, authUser?.id ?? null),
  ]);
  return toDTO(doc, { rsvpCount, viewer, now });
};

export async function createEvent(authUser, playgroundId, body) {
  assertAuth(authUser);
  assertObjectId(playgroundId, 'playgroundId');
  await assertPlaygroundExists(playgroundId);

  const { sportId, startAt, durationMin, description, maxParticipants } = body ?? {};
  await assertSportExists(sportId);
  const start = parseStartAt(startAt);
  assertStartInWindow(start);
  const duration = parseDuration(durationMin);
  const limit = parseMaxParticipants(maxParticipants);
  const text = parseDescription(description);

  const created = await eventRepository.create({
    playground: new mongoose.Types.ObjectId(playgroundId),
    sport: new mongoose.Types.ObjectId(sportId),
    creator: new mongoose.Types.ObjectId(authUser.id),
    startAt: start,
    durationMin: duration,
    description: text,
    maxParticipants: limit,
    status: 'active',
  });
  const hydrated = await eventRepository.findHydratedById(created._id);
  return hydrateEventDTO(hydrated, authUser);
}

export async function getEventById(authUser, eventId) {
  assertObjectId(eventId, 'id');
  const doc = await eventRepository.findHydratedById(eventId);
  if (!doc) {
    throw new DomainError('Event not found', httpStatus.NOT_FOUND);
  }
  return hydrateEventDTO(doc, authUser);
}

const EVENTS_DEFAULT_LIMIT = 10;
const EVENTS_MAX_LIMIT = 50;

const parseEventsPagination = (query) => {
  const rawLimit = Number.parseInt(query?.limit, 10);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, EVENTS_MAX_LIMIT)
      : EVENTS_DEFAULT_LIMIT;
  const rawPage = Number.parseInt(query?.page, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  return { limit, page, offset: (page - 1) * limit };
};

const resolveTimeFilter = (rawTime) => {
  const time = rawTime === 'past' || rawTime === 'all' ? rawTime : 'upcoming';
  const now = new Date();
  if (time === 'upcoming') {
    return { time, fromDate: now, toDate: null, sortDir: 1 };
  }
  if (time === 'past') {
    return { time, fromDate: null, toDate: now, sortDir: -1 };
  }
  return { time, fromDate: null, toDate: null, sortDir: -1 };
};

export async function listEventsByPlayground(authUser, playgroundId, query) {
  assertObjectId(playgroundId, 'playgroundId');
  const status = query?.status === 'all' ? 'all' : 'active';
  const { time, fromDate, toDate, sortDir } = resolveTimeFilter(query?.time);
  const { limit, page, offset } = parseEventsPagination(query);

  const { items: docs, total } = await eventRepository.listByPlayground({
    playgroundId,
    status,
    fromDate,
    toDate,
    sortDir,
    limit,
    offset,
  });

  const now = new Date();
  const items = await Promise.all(
    docs.map((doc) => hydrateEventDTO(doc, authUser, now))
  );
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    time,
  };
}

const assertCreator = (doc, authUser) => {
  const creatorId = doc.creator?._id?.toString?.() ?? doc.creator?.toString?.();
  if (creatorId !== authUser.id) {
    throw new DomainError('Forbidden', httpStatus.FORBIDDEN, {
      code: 'forbidden',
    });
  }
};

const ALLOWED_UPDATE_KEYS = [
  'sportId',
  'startAt',
  'durationMin',
  'description',
  'maxParticipants',
];

const buildUpdatePatch = async (body) => {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'sportId')) {
    await assertSportExists(body.sportId);
    patch.sport = new mongoose.Types.ObjectId(body.sportId);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'startAt')) {
    const start = parseStartAt(body.startAt);
    assertStartInWindow(start);
    patch.startAt = start;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'durationMin')) {
    patch.durationMin = parseDuration(body.durationMin);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    patch.description = parseDescription(body.description);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'maxParticipants')) {
    patch.maxParticipants = parseMaxParticipants(body.maxParticipants);
  }
  return patch;
};

export async function updateEvent(authUser, eventId, body) {
  assertAuth(authUser);
  assertObjectId(eventId, 'id');
  const existing = await eventRepository.findByIdRaw(eventId);
  if (!existing) {
    throw new DomainError('Event not found', httpStatus.NOT_FOUND);
  }
  if (existing.status !== 'active') {
    throw new DomainError('Event is not active', httpStatus.BAD_REQUEST, {
      code: 'eventNotActive',
    });
  }
  assertCreator(existing, authUser);

  const allowedBody = Object.fromEntries(
    Object.entries(body ?? {}).filter(([key]) => ALLOWED_UPDATE_KEYS.includes(key))
  );
  const patch = await buildUpdatePatch(allowedBody);
  if (Object.keys(patch).length === 0) {
    throw new DomainError('Nothing to update', httpStatus.BAD_REQUEST);
  }
  const updated = await eventRepository.updateById(eventId, patch);
  return hydrateEventDTO(updated, authUser);
}

export async function cancelEvent(authUser, eventId) {
  assertAuth(authUser);
  assertObjectId(eventId, 'id');
  const existing = await eventRepository.findByIdRaw(eventId);
  if (!existing) {
    throw new DomainError('Event not found', httpStatus.NOT_FOUND);
  }
  assertCreator(existing, authUser);
  if (existing.status !== 'active') {
    return hydrateEventDTO(await eventRepository.findHydratedById(eventId), authUser);
  }
  const updated = await eventRepository.updateById(eventId, {
    status: 'cancelled',
    cancelledAt: new Date(),
  });
  return hydrateEventDTO(updated, authUser);
}

export async function rsvpToEvent(authUser, eventId) {
  assertAuth(authUser);
  assertObjectId(eventId, 'id');
  const event = await eventRepository.findByIdRaw(eventId);
  if (!event) {
    throw new DomainError('Event not found', httpStatus.NOT_FOUND);
  }
  if (event.status !== 'active') {
    throw new DomainError('Event is not active', httpStatus.BAD_REQUEST, {
      code: 'eventNotActive',
    });
  }
  const existing = await eventRsvpRepository.findOne({
    eventId,
    userId: authUser.id,
  });
  if (existing) {
    const rsvpCount = await eventRsvpRepository.countByEvent(eventId);
    return toRsvpResponse({
      rsvpCount,
      maxParticipants: event.maxParticipants ?? null,
      isRsvped: true,
    });
  }
  if (
    event.maxParticipants !== null &&
    event.maxParticipants !== undefined
  ) {
    const currentCount = await eventRsvpRepository.countByEvent(eventId);
    if (currentCount >= event.maxParticipants) {
      throw new DomainError('Event is full', httpStatus.CONFLICT, {
        code: 'eventFull',
      });
    }
  }
  await eventRsvpRepository.createIfMissing({
    eventId,
    userId: authUser.id,
  });
  const rsvpCount = await eventRsvpRepository.countByEvent(eventId);
  return toRsvpResponse({
    rsvpCount,
    maxParticipants: event.maxParticipants ?? null,
    isRsvped: true,
  });
}

export async function unrsvpFromEvent(authUser, eventId) {
  assertAuth(authUser);
  assertObjectId(eventId, 'id');
  const event = await eventRepository.findByIdRaw(eventId);
  if (!event) {
    throw new DomainError('Event not found', httpStatus.NOT_FOUND);
  }
  if (event.status !== 'active') {
    throw new DomainError('Event is not active', httpStatus.BAD_REQUEST, {
      code: 'eventNotActive',
    });
  }
  await eventRsvpRepository.deleteOne({
    eventId,
    userId: authUser.id,
  });
  const rsvpCount = await eventRsvpRepository.countByEvent(eventId);
  return toRsvpResponse({
    rsvpCount,
    maxParticipants: event.maxParticipants ?? null,
    isRsvped: false,
  });
}
