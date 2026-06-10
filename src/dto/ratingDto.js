const isPopulatedUser = (value) =>
  value && typeof value === 'object' && '_id' in value;

const toUserDTO = (user) => {
  if (!isPopulatedUser(user)) {
    return { id: null, name: null };
  }
  return {
    id: user._id.toString(),
    name: user.name ?? null,
  };
};

export function toRatingDTO(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    targetType: doc.targetType,
    targetId: doc.targetId?.toString?.() ?? null,
    user: toUserDTO(doc.user),
    value: doc.value,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
  };
}

export function toAggregateDTO(aggregate) {
  return {
    average: aggregate.average ?? null,
    count: aggregate.count ?? 0,
  };
}
