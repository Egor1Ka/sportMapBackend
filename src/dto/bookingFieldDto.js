const toBookingFieldDto = (doc) => ({
  id: doc._id.toString(),
  ownerId: doc.ownerId.toString(),
  ownerType: doc.ownerType,
  eventTypeId: doc.eventTypeId ? doc.eventTypeId.toString() : null,
  type: doc.type,
  label: doc.label,
  required: doc.required,
  createdAt: doc.createdAt.toISOString(),
});

export { toBookingFieldDto };
