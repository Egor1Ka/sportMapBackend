const toBookingStatusDto = (doc) => ({
  id: doc._id.toString(),
  label: doc.label,
  color: doc.color,
  actions: doc.actions,
  isDefault: doc.isDefault,
  isArchived: doc.isArchived,
  orgId: doc.orgId ? doc.orgId.toString() : null,
  userId: doc.userId ? doc.userId.toString() : null,
  order: doc.order,
});

export { toBookingStatusDto };
