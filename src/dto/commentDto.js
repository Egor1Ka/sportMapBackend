const isPopulatedAuthor = (value) =>
  value && typeof value === 'object' && '_id' in value;

const toAuthorDTO = (author) => {
  if (!isPopulatedAuthor(author)) {
    return { id: null, name: null, avatar: null };
  }
  return {
    id: author._id.toString(),
    name: author.name ?? null,
    avatar: author.avatar ?? null,
  };
};

export function toDTO(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    targetType: doc.targetType,
    targetId: doc.targetId?.toString?.() ?? null,
    text: doc.text,
    author: toAuthorDTO(doc.author),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
  };
}
