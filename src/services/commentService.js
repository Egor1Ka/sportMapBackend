import mongoose from 'mongoose';
import * as commentRepository from '../repository/comment.js';
import * as playgroundRepository from '../repository/playground.js';
import { User } from '../models/User.js';
import { toDTO } from '../dto/commentDto.js';
import { COMMENT_TARGET_TYPES } from '../models/Comment.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const MAX_TEXT_LENGTH = 2000;

const TARGET_REPOSITORIES = {
  playground: playgroundRepository,
};

const isValidObjectId = (value) =>
  typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const parseLimit = (raw) => {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_LIMIT;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
};

const parseOffset = (raw) => {
  if (raw === undefined || raw === null || raw === '') return 0;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 0) return 0;
  return value;
};

const assertValidTargetType = (targetType) => {
  if (!COMMENT_TARGET_TYPES.includes(targetType)) {
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

const assertValidText = (text) => {
  if (typeof text !== 'string') {
    throw new DomainError('text is required', httpStatus.BAD_REQUEST);
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new DomainError('text must not be empty', httpStatus.BAD_REQUEST);
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new DomainError(
      `text must be at most ${MAX_TEXT_LENGTH} characters`,
      httpStatus.BAD_REQUEST
    );
  }
  return trimmed;
};

export async function createComment(authUser, body) {
  if (!authUser || !authUser.id) {
    throw new DomainError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const { targetType, targetId, text } = body ?? {};
  assertValidTargetType(targetType);
  assertValidTargetId(targetId);
  const trimmedText = assertValidText(text);
  await assertTargetExists(targetType, targetId);

  const doc = await commentRepository.create({
    targetType,
    targetId: new mongoose.Types.ObjectId(targetId),
    author: new mongoose.Types.ObjectId(authUser.id),
    text: trimmedText,
  });
  return toDTO(doc.toObject ? doc.toObject() : doc);
}

export async function listComments(query) {
  const { targetType, targetId } = query ?? {};
  assertValidTargetType(targetType);
  assertValidTargetId(targetId);

  const limit = parseLimit(query.limit);
  const offset = parseOffset(query.offset);

  const { items, total } = await commentRepository.listByTarget({
    targetType,
    targetId: new mongoose.Types.ObjectId(targetId),
    limit,
    offset,
  });
  return {
    items: items.map(toDTO),
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

const isAdmin = async (userId) => {
  const user = await User.findById(userId).select('role').lean().exec();
  return user?.role === 'admin';
};

export async function deleteComment(authUser, commentId) {
  if (!authUser || !authUser.id) {
    throw new DomainError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  if (!isValidObjectId(commentId)) {
    throw new DomainError('Invalid id', httpStatus.BAD_REQUEST);
  }
  const doc = await commentRepository.findById(commentId);
  if (!doc) {
    throw new DomainError('Comment not found', httpStatus.NOT_FOUND);
  }
  const authorId = doc.author?._id?.toString?.() ?? doc.author?.toString?.();
  const isOwner = authorId === authUser.id;
  const admin = isOwner ? false : await isAdmin(authUser.id);
  if (!isOwner && !admin) {
    throw new DomainError('Forbidden', httpStatus.FORBIDDEN);
  }
  await commentRepository.deleteById(commentId);
  return { id: commentId };
}
