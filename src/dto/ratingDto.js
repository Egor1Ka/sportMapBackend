const toRatingDto = (doc) => ({
  id: doc._id.toString(),
  authorId: doc.authorId.toString(),
  targetType: doc.targetType,
  targetId: doc.targetId.toString(),
  value: doc.value,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export { toRatingDto };
