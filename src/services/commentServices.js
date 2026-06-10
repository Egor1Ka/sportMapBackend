import EventType from "../models/EventType.js";
import Membership from "../models/Membership.js";
import User from "../modules/user/model/User.js";
import * as commentRepo from "../repository/commentRepository.js";
import { toCommentDto } from "../dto/commentDto.js";
import { HttpError } from "../shared/utils/http/httpError.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";

const TARGET_MODELS = {
  EventType,
  User,
  Membership,
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

const clampLimit = (raw) => {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const clampOffset = (raw) => {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
};

const listForTarget = async ({ targetType, targetId, limit, offset }) => {
  await assertTargetExists(targetType, targetId);
  return commentRepo.listCommentsForTarget({
    targetType,
    targetId,
    limit: clampLimit(limit),
    offset: clampOffset(offset),
  });
};

const createForTarget = async ({ authorId, targetType, targetId, body }) => {
  await assertTargetExists(targetType, targetId);
  const doc = await commentRepo.createComment({ authorId, targetType, targetId, body });
  await doc.populate("authorId", "name avatar");
  return toCommentDto(doc.toObject(), doc.authorId);
};

const updateOwn = async ({ commentId, authorId, body }) => {
  const existing = await commentRepo.findCommentById(commentId);
  if (!existing) throw new HttpError(generalStatus.NOT_FOUND);
  if (String(existing.authorId) !== String(authorId)) {
    throw new HttpError(generalStatus.FORBIDDEN);
  }
  const updated = await commentRepo.updateOwnComment(commentId, body);
  await updated.populate("authorId", "name avatar");
  return toCommentDto(updated.toObject(), updated.authorId);
};

const deleteOwn = async ({ commentId, authorId }) => {
  const existing = await commentRepo.findCommentById(commentId);
  if (!existing) throw new HttpError(generalStatus.NOT_FOUND);
  if (String(existing.authorId) !== String(authorId)) {
    throw new HttpError(generalStatus.FORBIDDEN);
  }
  await commentRepo.deleteCommentById(commentId);
};

export { listForTarget, createForTarget, updateOwn, deleteOwn };
