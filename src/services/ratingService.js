import mongoose from 'mongoose';
import * as ratingRepository from '../repository/rating.js';
import * as playgroundRepository from '../repository/playground.js';
import { toRatingDTO, toAggregateDTO } from '../dto/ratingDto.js';
import { RATING_TARGET_TYPES } from '../models/Rating.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';

const MIN_VALUE = 1;
const MAX_VALUE = 5;

const TARGET_REPOSITORIES = {
  playground: playgroundRepository,
};

const isValidObjectId = (value) =>
  typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const assertValidTargetType = (targetType) => {
  if (!RATING_TARGET_TYPES.includes(targetType)) {
    throw new DomainError(
      `Unsupported targetType "${targetType}"`,
      httpStatus.BAD_REQUEST
    );
  }
};

const assertValidTargetId = (targetId) => {
  if (!isValidObjectId(targetId)) {
    throw new DomainError('Invalid targetId', httpStatus.BAD_REQUEST);
  }
};

const assertTargetExists = async (targetType, targetId) => {
  const repo = TARGET_REPOSITORIES[targetType];
  const entity = await repo.findById(targetId);
  if (!entity) {
    throw new DomainError(
      `Target ${targetType} not found`,
      httpStatus.NOT_FOUND
    );
  }
};

const assertValidValue = (value) => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new DomainError(
      `value must be an integer between ${MIN_VALUE} and ${MAX_VALUE}`,
      httpStatus.BAD_REQUEST
    );
  }
  if (value < MIN_VALUE || value > MAX_VALUE) {
    throw new DomainError(
      `value must be between ${MIN_VALUE} and ${MAX_VALUE}`,
      httpStatus.BAD_REQUEST
    );
  }
};

export async function upsertRating(authUser, body) {
  if (!authUser || !authUser.id) {
    throw new DomainError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const { targetType, targetId, value } = body ?? {};
  assertValidTargetType(targetType);
  assertValidTargetId(targetId);
  assertValidValue(value);
  await assertTargetExists(targetType, targetId);

  const doc = await ratingRepository.upsert({
    targetType,
    targetId: new mongoose.Types.ObjectId(targetId),
    user: new mongoose.Types.ObjectId(authUser.id),
    value,
  });
  return toRatingDTO(doc.toObject ? doc.toObject() : doc);
}

export async function getAggregate(query) {
  const { targetType, targetId } = query ?? {};
  assertValidTargetType(targetType);
  assertValidTargetId(targetId);

  const aggregate = await ratingRepository.getAggregate({
    targetType,
    targetId: new mongoose.Types.ObjectId(targetId),
  });
  return toAggregateDTO(aggregate);
}

export async function getMine(authUser, query) {
  if (!authUser || !authUser.id) {
    throw new DomainError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const { targetType, targetId } = query ?? {};
  assertValidTargetType(targetType);
  assertValidTargetId(targetId);

  const doc = await ratingRepository.findMine({
    targetType,
    targetId: new mongoose.Types.ObjectId(targetId),
    user: new mongoose.Types.ObjectId(authUser.id),
  });
  return { value: doc?.value ?? null };
}
