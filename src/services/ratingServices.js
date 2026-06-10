import EventType from "../models/EventType.js";
import Membership from "../models/Membership.js";
import User from "../modules/user/model/User.js";
import * as ratingRepo from "../repository/ratingRepository.js";
import { HttpError } from "../shared/utils/http/httpError.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";

const TARGET_MODELS = {
  EventType,
  User,
  Membership,
};

const assertTargetExists = async (targetType, targetId) => {
  const Model = TARGET_MODELS[targetType];
  if (!Model) {
    throw new HttpError(generalStatus.BAD_REQUEST, { reason: "Invalid targetType" });
  }
  const exists = await Model.exists({ _id: targetId });
  if (!exists) {
    throw new HttpError(generalStatus.NOT_FOUND, { reason: "Target not found" });
  }
};

const setRating = async ({ authorId, targetType, targetId, value }) => {
  await assertTargetExists(targetType, targetId);
  return ratingRepo.upsertRating({ authorId, targetType, targetId, value });
};

const removeMyRating = async ({ authorId, targetType, targetId }) => {
  await assertTargetExists(targetType, targetId);
  await ratingRepo.deleteOwnRating({ authorId, targetType, targetId });
};

const getRatingSummary = async ({ targetType, targetId, viewerId = null }) => {
  await assertTargetExists(targetType, targetId);
  const summary = await ratingRepo.getSummary({ targetType, targetId });
  const myRating = viewerId
    ? await ratingRepo.getMyRating({ authorId: viewerId, targetType, targetId })
    : null;
  return { ...summary, myRating };
};

export { setRating, removeMyRating, getRatingSummary };
