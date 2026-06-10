const toNotificationDto = (doc) => ({
  id: doc._id.toString(),
  bookingId: doc.bookingId.toString(),
  recipientId: doc.recipientId.toString(),
  recipientType: doc.recipientType,
  channel: doc.channel,
  type: doc.type,
  status: doc.status,
  scheduledAt: doc.scheduledAt,
});

export { toNotificationDto };
