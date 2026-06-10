// Filters out entries with undefined env var keys to prevent "undefined" string keys
const fromEnvEntries = (...entries) =>
  Object.fromEntries(entries.filter(([productId]) => productId !== undefined));

// ── Подписочные продукты → ключ плана ────────────────────────────────────────

export const SUBSCRIPTION_PRODUCTS = fromEnvEntries(
  [process.env.CREEM_PRODUCT_ORG_CREATOR, "org_creator"],
);

// ── Одноразовые продукты → ключ продукта ─────────────────────────────────────

export const ONE_TIME_PRODUCTS = fromEnvEntries();

// ── Определения продуктов (фичи и лимиты) ───────────────────────────────────

export const PRODUCTS = {};

// ── Plan hierarchy (weakest → strongest) ─────────────────────────────────────

export const PLAN_HIERARCHY = ["free", "org_creator"];

// ── Plan features & limits ───────────────────────────────────────────────────

export const PLANS = {
  free: {
    features: { dashboard: true, createOrg: false },
    limits: { organizations: 0 },
  },
  org_creator: {
    features: { dashboard: true, createOrg: true },
    limits: { organizations: 3 },
  },
};

// ── Plan catalog (UI/checkout data) ────────────────────────────────────────

export const PLAN_CATALOG = {
  free: {
    price: 0,
    currency: "USD",
    period: "month",
    productId: null,
  },
  org_creator: {
    price: 499,
    currency: "USD",
    period: "month",
    productId: process.env.CREEM_PRODUCT_ORG_CREATOR,
  },
};

// ── Product catalog (UI/checkout data) ─────────────────────────────────────

export const PRODUCT_CATALOG = {};

// ── Startup validation ─────────────────────────────────────────────────────────

const requiredProductEnvVars = [
  "CREEM_PRODUCT_ORG_CREATOR",
];

const missingVars = requiredProductEnvVars.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  console.warn(
    `⚠️ Missing billing product IDs: ${missingVars.join(", ")}. Billing features may not work correctly. Add them to .env`,
  );
}

// ── Subscription statuses ────────────────────────────────────────────────────

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
  EXPIRED: "expired",
  PAUSED: "paused",
  SCHEDULED_CANCEL: "scheduled_cancel",
};

export const ACCESS_GRANTING_STATUSES = [
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.PAST_DUE,
  SUBSCRIPTION_STATUS.SCHEDULED_CANCEL,
];

// ── Webhook event types ──────────────────────────────────────────────────────

export const WEBHOOK_EVENT = {
  CHECKOUT_COMPLETED: "checkout.completed",
  SUBSCRIPTION_ACTIVE: "subscription.active",
  SUBSCRIPTION_PAID: "subscription.paid",
  SUBSCRIPTION_PAST_DUE: "subscription.past_due",
  SUBSCRIPTION_CANCELED: "subscription.canceled",
  SUBSCRIPTION_EXPIRED: "subscription.expired",
  SUBSCRIPTION_PAUSED: "subscription.paused",
  SUBSCRIPTION_SCHEDULED_CANCEL: "subscription.scheduled_cancel",
  REFUND_CREATED: "refund.created",
  DISPUTE_CREATED: "dispute.created",
};

// ── Webhook event → subscription status ──────────────────────────────────────

export const WEBHOOK_STATUS_MAP = {
  [WEBHOOK_EVENT.SUBSCRIPTION_ACTIVE]: SUBSCRIPTION_STATUS.ACTIVE,
  [WEBHOOK_EVENT.SUBSCRIPTION_PAID]: SUBSCRIPTION_STATUS.ACTIVE,
  [WEBHOOK_EVENT.SUBSCRIPTION_PAST_DUE]: SUBSCRIPTION_STATUS.PAST_DUE,
  [WEBHOOK_EVENT.SUBSCRIPTION_CANCELED]: SUBSCRIPTION_STATUS.CANCELED,
  [WEBHOOK_EVENT.SUBSCRIPTION_EXPIRED]: SUBSCRIPTION_STATUS.EXPIRED,
  [WEBHOOK_EVENT.SUBSCRIPTION_PAUSED]: SUBSCRIPTION_STATUS.PAUSED,
  [WEBHOOK_EVENT.SUBSCRIPTION_SCHEDULED_CANCEL]: SUBSCRIPTION_STATUS.SCHEDULED_CANCEL,
};
