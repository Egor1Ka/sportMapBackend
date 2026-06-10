import Comment from "../models/Comment.js";
import { toCommentDto } from "../dto/commentDto.js";

const createComment = async ({ authorId, targetType, targetId, body }) => {
  const doc = await Comment.create({ authorId, targetType, targetId, body });
  return doc;
};

const findCommentById = async (id) => {
  return Comment.findById(id);
};

const updateOwnComment = async (id, body) => {
  return Comment.findByIdAndUpdate(id, { $set: { body } }, { new: true, runValidators: true });
};

const deleteCommentById = async (id) => {
  return Comment.findByIdAndDelete(id);
};

const listCommentsForTarget = async ({ targetType, targetId, limit, offset }) => {
  const [items, total] = await Promise.all([
    Comment.find({ targetType, targetId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("authorId", "name avatar")
      .lean(),
    Comment.countDocuments({ targetType, targetId }),
  ]);

  const dtos = items.map((doc) => toCommentDto(doc, doc.authorId));
  return { items: dtos, total };
};

const deleteByTarget = async ({ targetType, targetId }) => {
  await Comment.deleteMany({ targetType, targetId });
};

const deleteByAuthor = async (authorId) => {
  await Comment.deleteMany({ authorId });
};

export {
  createComment,
  findCommentById,
  updateOwnComment,
  deleteCommentById,
  listCommentsForTarget,
  deleteByTarget,
  deleteByAuthor,
};
