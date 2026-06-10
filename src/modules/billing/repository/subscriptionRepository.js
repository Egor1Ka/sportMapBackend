import Subscription from "../model/Subscription.js";
import { ACCESS_GRANTING_STATUSES } from "../constants/billing.js";
import { subscriptionToDTO } from "../dto/billingDto.js";

const upsertByProviderSubscriptionId = async (providerSubscriptionId, data) => {
  const doc = await Subscription.findOneAndUpdate(
    { providerSubscriptionId },
    data,
    { upsert: true, new: true },
  );
  return subscriptionToDTO(doc);
};

const getActiveSubscriptionByUserId = async (userId) => {
  const doc = await Subscription.findOne({
    userId,
    status: { $in: ACCESS_GRANTING_STATUSES },
  });
  if (!doc) return null;
  return subscriptionToDTO(doc);
};

const getSubscriptionByProviderId = async (providerSubscriptionId) => {
  const doc = await Subscription.findOne({ providerSubscriptionId });
  if (!doc) return null;
  return subscriptionToDTO(doc);
};

const updateStatusByProviderId = async (providerSubscriptionId, updateFields) => {
  const before = await Subscription.findOne({ providerSubscriptionId });
  if (!before) return null;

  const after = await Subscription.findOneAndUpdate(
    { providerSubscriptionId },
    updateFields,
    { new: true },
  );

  return {
    before: subscriptionToDTO(before),
    after: subscriptionToDTO(after),
  };
};

export { upsertByProviderSubscriptionId, getActiveSubscriptionByUserId, getSubscriptionByProviderId, updateStatusByProviderId };
