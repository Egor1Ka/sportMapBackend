import { getActiveSubscriptionByUserId } from "../repository/subscriptionRepository.js";
import { getOrdersByUserId } from "../repository/orderRepository.js";
import {
  SUBSCRIPTION_PRODUCTS,
  ONE_TIME_PRODUCTS,
  PRODUCTS,
  PLANS,
} from "../constants/billing.js";

// ── Pure functions ───────────────────────────────────────────────────────────

const resolveSubscriptionPlanKey = (productId) => SUBSCRIPTION_PRODUCTS[productId] || "free";

const resolveProductKey = (productId) => ONE_TIME_PRODUCTS[productId] || null;

const getProductConfig = (productKey) => PRODUCTS[productKey] || null;

const getPlanConfig = (planKey) => PLANS[planKey] || PLANS.free;

const planHasFeature = (plan, featureName) => !!plan.features[featureName];

const getPlanLimit = (plan, limitName) => plan.limits[limitName];

// ── Merge logic ──────────────────────────────────────────────────────────────

const mergeFeatureEntry = (merged, config) => {
  const applyFeature = (acc, key) => ({
    ...acc,
    [key]: acc[key] || config.features[key],
  });
  return Object.keys(config.features).reduce(applyFeature, merged);
};

const mergeFeatures = (planFeatures, productConfigs) =>
  productConfigs.reduce(mergeFeatureEntry, { ...planFeatures });

const mergeLimitEntry = (merged, config) => {
  const applyLimit = (acc, key) => ({
    ...acc,
    [key]: Math.max(acc[key] || 0, config.limits[key] || 0),
  });
  return Object.keys(config.limits).reduce(applyLimit, merged);
};

const mergeLimits = (planLimits, productConfigs) =>
  productConfigs.reduce(mergeLimitEntry, { ...planLimits });

// ── Orchestrators (side effects) ─────────────────────────────────────────────

const toProductConfig = (order) => getProductConfig(order.productKey);
const isValidConfig = (config) => config !== null;
const toProductKey = (order) => order.productKey;

const getUserBillingProfile = async (userId) => {
  const [subscription, orders] = await Promise.all([
    getActiveSubscriptionByUserId(userId),
    getOrdersByUserId(userId),
  ]);

  const planKey = subscription ? subscription.planKey : "free";
  const planConfig = getPlanConfig(planKey);
  const productConfigs = orders.map(toProductConfig).filter(isValidConfig);

  return {
    key: planKey,
    features: mergeFeatures(planConfig.features, productConfigs),
    limits: mergeLimits(planConfig.limits, productConfigs),
    products: orders.map(toProductKey),
  };
};

const userHasFeature = async (userId, featureName) => {
  const profile = await getUserBillingProfile(userId);
  return planHasFeature(profile, featureName);
};

const getUserLimit = async (userId, limitName) => {
  const profile = await getUserBillingProfile(userId);
  return getPlanLimit(profile, limitName);
};

export {
  resolveSubscriptionPlanKey,
  resolveProductKey,
  getProductConfig,
  getPlanConfig,
  planHasFeature,
  getPlanLimit,
  getUserBillingProfile,
  userHasFeature,
  getUserLimit,
};
