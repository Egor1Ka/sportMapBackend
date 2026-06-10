// ── Task DTO ────────────────────────────────────────────────────────────────
// Transforms a Mongoose document into a plain response object.
// Never expose raw MongoDB docs — always go through a DTO.
// Copy this file and map your own entity's fields.

const toTaskDto = (doc) => ({
  id: doc._id.toString(),
  title: doc.title,
  description: doc.description,
  status: doc.status,
  userId: doc.userId.toString(),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export { toTaskDto };
