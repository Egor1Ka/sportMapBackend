const toPositionDto = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  level: doc.level,
  color: doc.color || null,
  active: doc.active,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export { toPositionDto };
