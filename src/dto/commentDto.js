const toCommentDto = (doc, author = null) => ({
  id: doc._id.toString(),
  body: doc.body,
  targetType: doc.targetType,
  targetId: doc.targetId.toString(),
  author: author
    ? {
        id: author._id.toString(),
        name: author.name,
        avatar: author.avatar || null,
      }
    : { id: doc.authorId.toString(), name: null, avatar: null },
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export { toCommentDto };
