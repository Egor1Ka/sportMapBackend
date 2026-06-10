import http from "node:http";
import User from "../../user/model/User.js";
import Subscription from "../model/Subscription.js";

// ── Test constants ───────────────────────────────────────────────────────────

const TEST_PRODUCT_ORG_CREATOR = "test_product_org_creator";
const TEST_SUBSCRIPTION_ID = "sub_test_123";
const TEST_CUSTOMER_ID = "cus_test_456";
const TEST_ORDER_ID = "ord_test_789";
const TEST_EMAIL = "test@example.com";

// ── User helper ──────────────────────────────────────────────────────────────

const createTestUser = async (email = TEST_EMAIL) => {
  const doc = await User.create({ name: "Test User", email });
  return doc;
};

// ── Subscription helper ──────────────────────────────────────────────────────

const createActiveSubscription = async (userId, overrides = {}) => {
  const defaults = {
    userId,
    providerSubscriptionId: TEST_SUBSCRIPTION_ID,
    providerCustomerId: TEST_CUSTOMER_ID,
    productId: TEST_PRODUCT_ORG_CREATOR,
    planKey: "org_creator",
    status: "active",
    currentPeriodStart: new Date("2026-03-01"),
    currentPeriodEnd: new Date("2026-04-01"),
  };
  const doc = await Subscription.create({ ...defaults, ...overrides });
  return doc;
};

// ── Webhook payload builders ─────────────────────────────────────────────────

const buildCheckoutPayload = (overrides = {}) => {
  const defaults = {
    order: { id: TEST_ORDER_ID, amount: 499, currency: "USD" },
    subscription: { id: TEST_SUBSCRIPTION_ID },
    customer: { id: TEST_CUSTOMER_ID, email: TEST_EMAIL },
    product: { id: TEST_PRODUCT_ORG_CREATOR },
    status: "completed",
  };
  return { ...defaults, ...overrides };
};

const buildSubscriptionEventPayload = (overrides = {}) => {
  const defaults = {
    id: TEST_SUBSCRIPTION_ID,
    product: { id: TEST_PRODUCT_ORG_CREATOR },
    customer: { id: TEST_CUSTOMER_ID, email: TEST_EMAIL },
    current_period_start_date: "2026-04-01T00:00:00Z",
    current_period_end_date: "2026-05-01T00:00:00Z",
    status: "active",
    canceled_at: null,
  };
  return { ...defaults, ...overrides };
};

const buildRenewalPayload = (overrides = {}) => ({
  ...buildSubscriptionEventPayload(overrides),
  last_transaction: {
    order: "ord_renewal_001",
    amount: 499,
    currency: "USD",
    ...(overrides.last_transaction || {}),
  },
});

// ── HTTP helper ──────────────────────────────────────────────────────────────

const sendWebhook = (baseUrl, eventType, objectData) => {
  const body = JSON.stringify({ eventType, object: objectData });
  const url = new URL("/billing/webhook", baseUrl);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "creem-signature": "test-signature",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, body: data ? JSON.parse(data) : null });
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
};

export {
  TEST_PRODUCT_ORG_CREATOR,
  TEST_SUBSCRIPTION_ID,
  TEST_CUSTOMER_ID,
  TEST_ORDER_ID,
  TEST_EMAIL,
  createTestUser,
  createActiveSubscription,
  buildCheckoutPayload,
  buildSubscriptionEventPayload,
  buildRenewalPayload,
  sendWebhook,
};
