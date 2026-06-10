import mongoose from 'mongoose';
import * as checkInRepository from '../repository/playgroundCheckIn.js';
import * as playgroundRepository from '../repository/playground.js';
import { toCheckInResponse } from '../dto/checkInDto.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';

const isValidObjectId = (value) =>
  typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const assertAuth = (authUser) => {
  if (!authUser || !authUser.id) {
    throw new DomainError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
};

const assertObjectId = (value, label) => {
  if (!isValidObjectId(value)) {
    throw new DomainError(`Invalid ${label}`, httpStatus.BAD_REQUEST);
  }
};

const buildResponse = async ({ playgroundId, viewerExpiresAt, isCheckedIn, now }) => {
  const activeCount = await checkInRepository.countActiveByPlayground(playgroundId, now);
  return toCheckInResponse({
    playgroundId,
    activeCount,
    viewer: {
      isCheckedIn,
      expiresAt: isCheckedIn ? viewerExpiresAt : null,
    },
  });
};

export async function checkIn(authUser, playgroundId) {
  assertAuth(authUser);
  assertObjectId(playgroundId, 'playgroundId');
  const playground = await playgroundRepository.findById(playgroundId);
  if (!playground) {
    throw new DomainError('Playground not found', httpStatus.NOT_FOUND);
  }
  const now = new Date();
  const newExpiresAt = new Date(now.getTime() + checkInRepository.CHECK_IN_DURATION);

  const sameActive = await checkInRepository.findActiveByUserAndPlayground(
    { userId: authUser.id, playgroundId },
    now
  );
  if (sameActive) {
    await checkInRepository.extendActiveOnPlayground(
      { userId: authUser.id, playgroundId, expiresAt: newExpiresAt },
      now
    );
    return buildResponse({
      playgroundId,
      viewerExpiresAt: newExpiresAt,
      isCheckedIn: true,
      now,
    });
  }
  await checkInRepository.leaveActiveByUser(authUser.id, now);
  await checkInRepository.createActive({
    userId: authUser.id,
    playgroundId,
    now,
  });
  return buildResponse({
    playgroundId,
    viewerExpiresAt: newExpiresAt,
    isCheckedIn: true,
    now,
  });
}

export async function checkOut(authUser, playgroundId) {
  assertAuth(authUser);
  assertObjectId(playgroundId, 'playgroundId');
  const now = new Date();
  await checkInRepository.leaveActiveByUserOnPlayground(
    { userId: authUser.id, playgroundId },
    now
  );
  return buildResponse({
    playgroundId,
    viewerExpiresAt: null,
    isCheckedIn: false,
    now,
  });
}
