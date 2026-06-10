import { Comment } from '../models/Comment.js';

export async function create(data) {
  const doc = await Comment.create(data);
  await doc.populate({ path: 'author', select: 'name avatar' });
  return doc;
}

export async function listByTarget({ targetType, targetId, limit, offset }) {
  const filter = { targetType, targetId };
  const [items, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .populate({ path: 'author', select: 'name avatar' })
      .lean()
      .exec(),
    Comment.countDocuments(filter).exec(),
  ]);
  return { items, total };
}

export function findById(id) {
  return Comment.findById(id)
    .populate({ path: 'author', select: 'name avatar' })
    .exec();
}

export function deleteById(id) {
  return Comment.findByIdAndDelete(id).exec();
}
