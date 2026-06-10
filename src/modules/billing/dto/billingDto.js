const formatOptionalId = (value) => {
  if (!value) return null;
  return value.toString();
};

const subscriptionToDTO = (doc) => ({
  id: doc._id.toString(),
  userId: doc.userId.toString(),
  providerSubscriptionId: doc.providerSubscriptionId,
  providerCustomerId: doc.providerCustomerId,
  productId: doc.productId,
  planKey: doc.planKey,
  status: doc.status,
  currentPeriodStart: doc.currentPeriodStart,
  currentPeriodEnd: doc.currentPeriodEnd,
  cancelAt: doc.cancelAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const paymentToDTO = (doc) => ({
  id: doc._id.toString(),
  userId: formatOptionalId(doc.userId),
  providerSubscriptionId: doc.providerSubscriptionId,
  providerEventId: doc.providerEventId,
  productId: doc.productId,
  type: doc.type,
  eventType: doc.eventType,
  amount: doc.amount,
  currency: doc.currency,
  providerPayload: doc.providerPayload,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const orderToDTO = (doc) => ({
  id: doc._id.toString(),
  userId: doc.userId.toString(),
  providerOrderId: doc.providerOrderId,
  productKey: doc.productKey,
  providerProductId: doc.providerProductId,
  amount: doc.amount,
  currency: doc.currency,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export { subscriptionToDTO, paymentToDTO, orderToDTO, formatOptionalId };
