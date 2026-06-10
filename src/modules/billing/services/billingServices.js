import { getUser, getUserById } from "../../user/index.js";
import { upsertByProviderSubscriptionId, getSubscriptionByProviderId, updateStatusByProviderId } from "../repository/subscriptionRepository.js";
import { createPayment } from "../repository/paymentRepository.js";
import { createOrder } from "../repository/orderRepository.js";
import { resolveSubscriptionPlanKey, resolveProductKey } from "./planServices.js";
import { getHooksForPlan } from "../hooks/productHooks.js";
import {
  SUBSCRIPTION_PRODUCTS,
  ONE_TIME_PRODUCTS,
  WEBHOOK_EVENT,
  WEBHOOK_STATUS_MAP,
  SUBSCRIPTION_STATUS,
  ACCESS_GRANTING_STATUSES,
} from "../constants/billing.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const isDuplicateKeyError = (error) => error.code === 11000;

const isAccessGranting = (status) => ACCESS_GRANTING_STATUSES.includes(status);

const isDeactivatingTransition = (oldStatus, newStatus) =>
  isAccessGranting(oldStatus) && !isAccessGranting(newStatus);

const isActivatingTransition = (oldStatus, newStatus) =>
  !isAccessGranting(oldStatus) && isAccessGranting(newStatus);

const isRenewal = (oldStatus, newStatus) =>
  oldStatus === SUBSCRIPTION_STATUS.ACTIVE
  && newStatus === SUBSCRIPTION_STATUS.ACTIVE;

const getPaymentType = (productId) =>
  SUBSCRIPTION_PRODUCTS[productId] ? "subscription" : "one_time";

// ── Run hook safely ──────────────────────────────────────────────────────────

const tryRunHook = async (planKey, hookName, user, subscription) => {
  const hooks = getHooksForPlan(planKey);
  if (!hooks || !hooks[hookName]) return;
  await hooks[hookName](user, subscription);
};

// ── Create payment (idempotent) ──────────────────────────────────────────────

const createPaymentSafe = async (paymentData) => {
  try {
    const result = await createPayment(paymentData);
    return result;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      console.log("[payment] duplicate, skipped. providerEventId:", paymentData.providerEventId);
      return null;
    }
    console.error("[payment] error creating payment:", error.message);
    throw error;
  }
};

// ── Create order (idempotent) ────────────────────────────────────────────────

const createOrderSafe = async (orderData) => {
  try {
    return await createOrder(orderData);
  } catch (error) {
    if (isDuplicateKeyError(error)) return null;
    throw error;
  }
};

// ── Build payment record ─────────────────────────────────────────────────────

const buildPaymentRecord = (userId, eventType, data) => ({
  userId,
  providerSubscriptionId: data.subscription_id || null,
  providerEventId: data.id,
  productId: data.product_id,
  type: getPaymentType(data.product_id),
  eventType,
  amount: data.amount,
  currency: data.currency,
  providerPayload: data,
});

// ── Build extra fields for subscription update ───────────────────────────────

const buildPeriodExtra = (data) => ({
  ...(data.current_period_start && { currentPeriodStart: new Date(data.current_period_start) }),
  ...(data.current_period_end && { currentPeriodEnd: new Date(data.current_period_end) }),
  ...(data.cancel_at && { cancelAt: new Date(data.cancel_at) }),
});

// ── Run transition hooks ─────────────────────────────────────────────────────

const runTransitionHooks = async (oldStatus, newStatus, user, subscription) => {
  if (!user || !oldStatus) return;

  if (isRenewal(oldStatus, newStatus)) {
    await tryRunHook(subscription.planKey, "onRenew", user, subscription);
    return;
  }

  if (isActivatingTransition(oldStatus, newStatus)) {
    await tryRunHook(subscription.planKey, "onActivate", user, subscription);
  }

  if (isDeactivatingTransition(oldStatus, newStatus)) {
    await tryRunHook(subscription.planKey, "onDeactivate", user, subscription);
  }
};

// ── Checkout processors ─────────────────────────────────────────────────────

const processSubscriptionCheckout = async (data) => {
  const user = await getUser({ email: data.customer_email });

  if (!user) {
    console.warn("[subscription-checkout] no user found for email:", data.customer_email, "— skipping");
    return;
  }

  const userId = user.id;
  const planKey = resolveSubscriptionPlanKey(data.product_id);

  const paymentRecord = buildPaymentRecord(userId, WEBHOOK_EVENT.CHECKOUT_COMPLETED, data);
  await createPaymentSafe(paymentRecord);

  const subscriptionData = {
    userId,
    providerSubscriptionId: data.subscription_id,
    providerCustomerId: data.customer_id,
    productId: data.product_id,
    planKey,
    status: SUBSCRIPTION_STATUS.ACTIVE,
  };

  const subscription = await upsertByProviderSubscriptionId(
    data.subscription_id,
    subscriptionData,
  );

  await tryRunHook(planKey, "onActivate", user, subscription);
};

const processOrderCheckout = async (data) => {
  const user = await getUser({ email: data.customer_email });
  const userId = user ? user.id : null;
  const productKey = resolveProductKey(data.product_id);

  const paymentRecord = buildPaymentRecord(userId, WEBHOOK_EVENT.CHECKOUT_COMPLETED, data);
  await createPaymentSafe(paymentRecord);

  const orderData = {
    userId,
    providerOrderId: data.id,
    productKey,
    providerProductId: data.product_id,
    amount: data.amount,
    currency: data.currency,
    providerPayload: data,
  };

  await createOrderSafe(orderData);
};

const processCheckoutCompleted = async (data) => {
  if (SUBSCRIPTION_PRODUCTS[data.product_id]) {
    return processSubscriptionCheckout(data);
  }
  if (ONE_TIME_PRODUCTS[data.product_id]) {
    return processOrderCheckout(data);
  }

  console.warn("[checkout] unknown product_id, skipping:", data.product_id);
};

// ── Subscription event processors ───────────────────────────────────────────

const processSubscriptionEvent = async (eventType, data) => {
  const newStatus = WEBHOOK_STATUS_MAP[eventType];
  if (!newStatus) return;

  const updateFields = { status: newStatus, ...buildPeriodExtra(data) };

  const result = await updateStatusByProviderId(
    data.subscription_id,
    updateFields,
  );

  if (!result) return;

  const oldStatus = result.before.status;
  const subscription = result.after;
  const user = await getUserById(result.before.userId);

  if (eventType === WEBHOOK_EVENT.SUBSCRIPTION_PAID) {
    const paymentRecord = buildPaymentRecord(
      result.before.userId,
      eventType,
      data,
    );
    await createPaymentSafe(paymentRecord);
  }

  await runTransitionHooks(oldStatus, newStatus, user, subscription);
};

// ── Simple event processor factory ───────────────────────────────────────────

const buildSimpleEventProcessor = (eventType) => async (data) => {
  const existing = data.subscription_id
    ? await getSubscriptionByProviderId(data.subscription_id)
    : null;
  const userId = existing ? existing.userId : null;
  const paymentRecord = buildPaymentRecord(userId, eventType, data);
  await createPaymentSafe(paymentRecord);
};

const processRefund = buildSimpleEventProcessor(WEBHOOK_EVENT.REFUND_CREATED);
const processDispute = buildSimpleEventProcessor(WEBHOOK_EVENT.DISPUTE_CREATED);

export { processCheckoutCompleted, processSubscriptionEvent, processRefund, processDispute };
