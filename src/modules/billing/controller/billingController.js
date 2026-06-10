import billingProviders from "../providers/index.js";
import { processCheckoutCompleted, processSubscriptionEvent, processRefund, processDispute } from "../services/billingServices.js";
import { getUserBillingProfile } from "../services/planServices.js";
import { getActiveSubscriptionByUserId } from "../repository/subscriptionRepository.js";
import { getPaymentsByUserId } from "../repository/paymentRepository.js";
import { getOrdersByUserId } from "../repository/orderRepository.js";
import { httpResponse, httpResponseError } from "../../../shared/utils/http/httpResponse.js";
import { generalStatus } from "../../../shared/utils/http/httpStatus.js";
import { WEBHOOK_EVENT, PLAN_HIERARCHY, PLAN_CATALOG, PRODUCT_CATALOG } from "../constants/billing.js";

const provider = billingProviders.getProvider();

// ── Webhook event → handler mapping ──────────────────────────────────────────

const buildStatusHandler = (eventType) => (data) =>
  processSubscriptionEvent(eventType, data);

const WEBHOOK_HANDLERS = {
  [WEBHOOK_EVENT.CHECKOUT_COMPLETED]:             processCheckoutCompleted,
  [WEBHOOK_EVENT.SUBSCRIPTION_ACTIVE]:            buildStatusHandler(WEBHOOK_EVENT.SUBSCRIPTION_ACTIVE),
  [WEBHOOK_EVENT.SUBSCRIPTION_PAID]:              buildStatusHandler(WEBHOOK_EVENT.SUBSCRIPTION_PAID),
  [WEBHOOK_EVENT.SUBSCRIPTION_PAST_DUE]:          buildStatusHandler(WEBHOOK_EVENT.SUBSCRIPTION_PAST_DUE),
  [WEBHOOK_EVENT.SUBSCRIPTION_CANCELED]:          buildStatusHandler(WEBHOOK_EVENT.SUBSCRIPTION_CANCELED),
  [WEBHOOK_EVENT.SUBSCRIPTION_EXPIRED]:           buildStatusHandler(WEBHOOK_EVENT.SUBSCRIPTION_EXPIRED),
  [WEBHOOK_EVENT.SUBSCRIPTION_PAUSED]:            buildStatusHandler(WEBHOOK_EVENT.SUBSCRIPTION_PAUSED),
  [WEBHOOK_EVENT.SUBSCRIPTION_SCHEDULED_CANCEL]:  buildStatusHandler(WEBHOOK_EVENT.SUBSCRIPTION_SCHEDULED_CANCEL),
  [WEBHOOK_EVENT.REFUND_CREATED]:                 processRefund,
  [WEBHOOK_EVENT.DISPUTE_CREATED]:                processDispute,
};

// ── Webhook handler ──────────────────────────────────────────────────────────

const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers[provider.signatureHeader];

    if (!signature) {
      httpResponse(res, generalStatus.BAD_REQUEST);
      return;
    }

    const rawBody = typeof req.body === "string"
      ? req.body
      : req.body.toString("utf-8");

    const event = provider.parseWebhookEvent(rawBody, signature);

    if (!event) {
      console.log("[webhook] parseWebhookEvent returned null");
      httpResponse(res, generalStatus.BAD_REQUEST);
      return;
    }


    const handler = WEBHOOK_HANDLERS[event.eventType];

    if (!handler) {
      console.log("[webhook] no handler for eventType:", event.eventType);
      httpResponse(res, generalStatus.SUCCESS);
      return;
    }

    await handler(event.data);
    console.log("[webhook] handler completed for:", event.eventType);
    httpResponse(res, generalStatus.SUCCESS);
  } catch (error) {
    console.error("[webhook] error:", error);
    httpResponseError(res, error);
  }
};

// ── Plan / Subscription / Payments / Orders ─────────────────────────────────

const getPlan = async (req, res) => {
  try {
    const profile = await getUserBillingProfile(req.user.id);
    httpResponse(res, generalStatus.SUCCESS, profile);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const getSubscription = async (req, res) => {
  try {
    const subscription = await getActiveSubscriptionByUserId(req.user.id);
    httpResponse(res, generalStatus.SUCCESS, subscription);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const getPayments = async (req, res) => {
  try {
    const payments = await getPaymentsByUserId(req.user.id);
    httpResponse(res, generalStatus.SUCCESS, payments);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const getOrders = async (req, res) => {
  try {
    const orders = await getOrdersByUserId(req.user.id);
    httpResponse(res, generalStatus.SUCCESS, orders);
  } catch (error) {
    httpResponseError(res, error);
  }
};

// ── Cancel ───────────────────────────────────────────────────────────────────

const cancelSubscription = async (req, res) => {
  try {
    const subscription = await getActiveSubscriptionByUserId(req.user.id);

    if (!subscription) {
      httpResponse(res, generalStatus.NOT_FOUND, {
        message: "No active subscription found",
      });
      return;
    }

    await provider.cancelSubscription(
      subscription.providerSubscriptionId,
      { mode: "scheduled", onExecute: "cancel" },
    );

    httpResponse(res, generalStatus.SUCCESS, subscription);
  } catch (error) {
    httpResponseError(res, error);
  }
};

// ── Catalog ───────────────────────────────────────────────────────────────────

const getCatalog = (_req, res) => {
  const toEntry = ([key, data]) => ({ key, ...data });

  const catalog = {
    plans: Object.entries(PLAN_CATALOG).map(toEntry),
    products: Object.entries(PRODUCT_CATALOG).map(toEntry),
    hierarchy: PLAN_HIERARCHY,
  };

  res.set("Cache-Control", "public, max-age=3600");
  httpResponse(res, generalStatus.SUCCESS, catalog);
};

export { handleWebhook, getPlan, getSubscription, getPayments, getOrders, cancelSubscription, getCatalog };
