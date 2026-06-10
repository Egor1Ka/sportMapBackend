# Billing Integration Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integration tests that verify webhook-to-database flows for billing subscriptions (create, renew, cancel).

**Architecture:** `node:test` + `mongodb-memory-server` + HTTP requests to a minimal Express app. The only mock is the Creem provider module (signature verification). Everything else is real: MongoDB, repositories, services, hooks.

**Tech Stack:** `node:test`, `node:assert`, `mongodb-memory-server`, `mongoose`, `express`

**Spec:** `docs/superpowers/specs/2026-03-22-billing-integration-tests-design.md`

---

### Task 1: Extract normalizers into shared module

**Files:**
- Create: `src/modules/billing/providers/normalizers.js`
- Modify: `src/modules/billing/providers/creem.js`

The normalizers are currently inlined in `creem.js`. Extract them into a shared module so the test mock can import the real normalizers instead of duplicating ~90 lines of code.

- [ ] **Step 1: Create `providers/normalizers.js`**

Move all normalizer functions and the `EVENT_NORMALIZERS` map from `creem.js` into this new file. Also move the `extractId` helper they depend on.

```js
// ── Helpers ─────────────────────────────────────────────────────────────────
// Creem may send product/customer/subscription as object or string (ID).

const extractId = (field) => field?.id ?? field ?? null;

// ── checkout.completed ──────────────────────────────────────────────────────

const normalizeCheckout = (raw) => ({
  id: raw.order?.id ?? raw.id,
  subscription_id: extractId(raw.subscription),
  customer_id: extractId(raw.customer),
  customer_email: raw.customer?.email ?? null,
  product_id: extractId(raw.product),
  amount: raw.order?.amount,
  currency: raw.order?.currency,
  current_period_start: null,
  current_period_end: null,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});

// ── subscription.paid ────────────────────────────────────────────────────────

const normalizeSubscriptionPayment = (raw) => ({
  id: raw.last_transaction?.order ?? raw.last_transaction_id ?? raw.last_transaction?.id ?? raw.id,
  subscription_id: raw.id,
  customer_id: extractId(raw.customer),
  customer_email: raw.customer?.email ?? null,
  product_id: extractId(raw.product),
  amount: raw.last_transaction?.amount,
  currency: raw.last_transaction?.currency,
  current_period_start: raw.current_period_start_date,
  current_period_end: raw.current_period_end_date,
  cancel_at: raw.canceled_at,
  status: raw.status,
  providerPayload: raw,
});

// ── Subscription status events ───────────────────────────────────────────────

const baseSubscriptionFields = (raw) => ({
  id: raw.id,
  subscription_id: raw.id,
  customer_id: extractId(raw.customer),
  customer_email: raw.customer?.email ?? null,
  product_id: extractId(raw.product),
  amount: null,
  currency: null,
  current_period_start: raw.current_period_start_date,
  current_period_end: raw.current_period_end_date,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});

const normalizeSubscriptionActive  = (raw) => baseSubscriptionFields(raw);
const normalizeSubscriptionExpired = (raw) => baseSubscriptionFields(raw);
const normalizeSubscriptionPaused  = (raw) => baseSubscriptionFields(raw);
const normalizeSubscriptionPastDue = (raw) => baseSubscriptionFields(raw);

const normalizeSubscriptionCanceled        = (raw) => ({ ...baseSubscriptionFields(raw), cancel_at: raw.canceled_at });
const normalizeSubscriptionScheduledCancel = (raw) => ({ ...baseSubscriptionFields(raw), cancel_at: raw.canceled_at });

// ── refund / dispute ─────────────────────────────────────────────────────────

const normalizeRefund = (raw) => ({
  id: raw.id,
  subscription_id: extractId(raw.subscription),
  customer_id: extractId(raw.customer),
  customer_email: raw.customer?.email ?? null,
  product_id: extractId(raw.product),
  amount: raw.amount,
  currency: raw.currency,
  current_period_start: null,
  current_period_end: null,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});

const normalizeDispute = (raw) => ({
  id: raw.id,
  subscription_id: extractId(raw.subscription),
  customer_id: extractId(raw.customer),
  customer_email: raw.customer?.email ?? null,
  product_id: extractId(raw.product),
  amount: raw.amount,
  currency: raw.currency,
  current_period_start: null,
  current_period_end: null,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});

// ── Event type → normalizer ─────────────────────────────────────────────────

const EVENT_NORMALIZERS = {
  "checkout.completed": normalizeCheckout,
  "subscription.paid": normalizeSubscriptionPayment,
  "subscription.active": normalizeSubscriptionActive,
  "subscription.canceled": normalizeSubscriptionCanceled,
  "subscription.expired": normalizeSubscriptionExpired,
  "subscription.paused": normalizeSubscriptionPaused,
  "subscription.past_due": normalizeSubscriptionPastDue,
  "subscription.scheduled_cancel": normalizeSubscriptionScheduledCancel,
  "refund.created": normalizeRefund,
  "dispute.created": normalizeDispute,
};

export { EVENT_NORMALIZERS, extractId };
```

- [ ] **Step 2: Update `creem.js` to import from `normalizers.js`**

Remove all normalizer functions, `extractId`, and `EVENT_NORMALIZERS` from `creem.js`. Replace with:

```js
import { EVENT_NORMALIZERS, extractId } from "./normalizers.js";
```

Keep everything else (`verifySignature`, `parseWebhookEvent`, `cancelSubscription`, etc.) unchanged. The `parseWebhookEvent` function already references `EVENT_NORMALIZERS` by name — no code changes needed beyond the import.

- [ ] **Step 3: Verify the app still works**

```bash
cd /Users/egorzozula/Desktop/BackendTemplate && node -e "import('./src/modules/billing/providers/creem.js').then(() => console.log('OK')).catch(e => console.error(e))" 2>&1 || echo "Check env vars"
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/billing/providers/normalizers.js src/modules/billing/providers/creem.js
git commit -m "refactor(billing): extract webhook normalizers into shared module"
```

---

### Task 2: Install dependency and add npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install mongodb-memory-server**

```bash
cd /Users/egorzozula/Desktop/BackendTemplate && npm install --save-dev mongodb-memory-server
```

- [ ] **Step 2: Add test scripts to package.json**

Add to `"scripts"`:

```json
"test": "node --experimental-test-module-mocks --test src/modules/billing/__tests__/billing.test.js",
"test:billing": "node --experimental-test-module-mocks --test src/modules/billing/__tests__/billing.test.js"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mongodb-memory-server and test scripts"
```

---

### Task 3: Create test setup (`setup.js`)

**Files:**
- Create: `src/modules/billing/__tests__/setup.js`

This file handles MongoMemoryServer lifecycle, Express app assembly, and provider mock. It must set env vars and register the mock **before** any billing module is imported.

- [ ] **Step 1: Write `setup.js`**

```js
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import express from "express";
import { mock } from "node:test";

// ── Environment variables ────────────────────────────────────────────────────
// Must be set before billing constants are imported (they read process.env at load time)
process.env.CREEM_PRODUCT_PRO = "test_product_pro";
process.env.CREEM_PRODUCT_EXPORT_PACK = "test_product_export_pack";

// ── Mock the Creem provider ──────────────────────────────────────────────────
// Must be registered before billingController imports providers/creem.js.
// The real creem.js reads CREEM_WEBHOOK_SECRET at load time and would crash without it.
// We import the REAL normalizers from the shared module — no duplication.

import { EVENT_NORMALIZERS } from "../providers/normalizers.js";

const mockParseWebhookEvent = (rawBody, _signature) => {
  const event = JSON.parse(rawBody);
  const eventType = event.eventType || event.event_type;
  const eventData = event.object || event.data || event;
  const normalize = EVENT_NORMALIZERS[eventType];
  if (!normalize) return { eventType, data: eventData };
  return { eventType, data: normalize(eventData) };
};

const mockCancelSubscription = () => {
  throw new Error("cancelSubscription is not available in tests");
};

mock.module("../providers/creem.js", {
  defaultExport: {
    signatureHeader: "creem-signature",
    parseWebhookEvent: mockParseWebhookEvent,
    cancelSubscription: mockCancelSubscription,
  },
});

// ── App builder ──────────────────────────────────────────────────────────────

let mongoServer;
let app;
let server;

const startServer = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Import billing routes AFTER mock is registered and DB is connected
  const { billingRouter } = await import("../../billing/index.js");

  app = express();
  // CRITICAL: express.raw() MUST come before express.json() — matches production app.js:15-16
  app.use("/billing/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use("/billing", billingRouter);

  // Start server once for the entire test suite (avoids port churn and leaked servers)
  server = app.listen(0);

  return app;
};

const getBaseUrl = () => {
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
};

const stopServer = async () => {
  if (server) server.close();
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
};

const clearCollections = async () => {
  const collections = mongoose.connection.collections;
  const clearCollection = ([, collection]) => collection.deleteMany({});
  await Promise.all(Object.entries(collections).map(clearCollection));
};

export { startServer, stopServer, clearCollections, getBaseUrl };
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/billing/__tests__/setup.js
git commit -m "test(billing): add test setup with MongoMemoryServer and provider mock"
```

---

### Task 4: Create test helpers (`helpers.js`)

**Files:**
- Create: `src/modules/billing/__tests__/helpers.js`

- [ ] **Step 1: Write `helpers.js`**

```js
import http from "node:http";
import User from "../../user/model/User.js";
import Subscription from "../model/Subscription.js";

// ── Test constants ───────────────────────────────────────────────────────────

const TEST_PRODUCT_PRO = "test_product_pro";
const TEST_SUBSCRIPTION_ID = "sub_test_123";
const TEST_CUSTOMER_ID = "cus_test_456";
const TEST_ORDER_ID = "ord_test_789";
const TEST_EMAIL = "test@example.com";

// ── User helper ──────────────────────────────────────────────────────────────
// Returns raw Mongoose doc — use doc._id for ObjectId in direct DB operations

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
    productId: TEST_PRODUCT_PRO,
    planKey: "pro",
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
    order: { id: TEST_ORDER_ID, amount: 2900, currency: "USD" },
    subscription: { id: TEST_SUBSCRIPTION_ID },
    customer: { id: TEST_CUSTOMER_ID, email: TEST_EMAIL },
    product: { id: TEST_PRODUCT_PRO },
    status: "completed",
  };
  return { ...defaults, ...overrides };
};

const buildSubscriptionEventPayload = (overrides = {}) => {
  const defaults = {
    id: TEST_SUBSCRIPTION_ID,
    product: { id: TEST_PRODUCT_PRO },
    customer: { id: TEST_CUSTOMER_ID, email: TEST_EMAIL },
    current_period_start_date: "2026-04-01T00:00:00Z",
    current_period_end_date: "2026-05-01T00:00:00Z",
    status: "active",
  };
  return { ...defaults, ...overrides };
};

const buildRenewalPayload = (overrides = {}) => ({
  ...buildSubscriptionEventPayload(overrides),
  last_transaction: {
    order: "ord_renewal_001",
    amount: 2900,
    currency: "USD",
    ...(overrides.last_transaction || {}),
  },
});

// ── HTTP helper ──────────────────────────────────────────────────────────────
// Uses the persistent server started in setup.js (no server-per-request)

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
  TEST_PRODUCT_PRO,
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
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/billing/__tests__/helpers.js
git commit -m "test(billing): add test helpers — user, subscription, webhook payload factories"
```

---

### Task 5: Write Group 1 tests — New Subscription (`checkout.completed`)

**Files:**
- Create: `src/modules/billing/__tests__/billing.test.js`

- [ ] **Step 1: Write test file with Group 1 tests**

```js
import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { startServer, stopServer, clearCollections, getBaseUrl } from "./setup.js";
import {
  createTestUser,
  buildCheckoutPayload,
  sendWebhook,
  TEST_PRODUCT_PRO,
  TEST_SUBSCRIPTION_ID,
  TEST_EMAIL,
} from "./helpers.js";
import Subscription from "../model/Subscription.js";
import Payment from "../model/Payment.js";

describe("Billing webhooks", () => {
  before(async () => {
    await startServer();
  });

  afterEach(async () => {
    await clearCollections();
  });

  after(async () => {
    await stopServer();
  });

  // ── Group 1: New Subscription (checkout.completed) ───────────────────────

  describe("checkout.completed", () => {
    it("1.1 creates subscription with active status", async () => {
      await createTestUser(TEST_EMAIL);
      const payload = buildCheckoutPayload();

      const res = await sendWebhook(getBaseUrl(), "checkout.completed", payload);
      assert.equal(res.statusCode, 200);

      const sub = await Subscription.findOne({ providerSubscriptionId: TEST_SUBSCRIPTION_ID });
      assert.ok(sub, "Subscription should exist in DB");
      assert.equal(sub.status, "active");
      assert.equal(sub.planKey, "pro");
      assert.equal(sub.productId, TEST_PRODUCT_PRO);
    });

    it("1.2 creates payment record", async () => {
      await createTestUser(TEST_EMAIL);
      const payload = buildCheckoutPayload();

      await sendWebhook(getBaseUrl(), "checkout.completed", payload);

      const payment = await Payment.findOne({ eventType: "checkout.completed" });
      assert.ok(payment, "Payment should exist in DB");
      assert.equal(payment.type, "subscription");
      assert.equal(payment.amount, 2900);
      assert.equal(payment.currency, "USD");
    });

    it("1.3 rejects webhook when user not found", async () => {
      const payload = buildCheckoutPayload({
        customer: { id: "cus_unknown", email: "unknown@example.com" },
      });

      const res = await sendWebhook(getBaseUrl(), "checkout.completed", payload);
      assert.equal(res.statusCode, 500);

      const subCount = await Subscription.countDocuments();
      assert.equal(subCount, 0, "No subscription should be created");

      const paymentCount = await Payment.countDocuments();
      assert.equal(paymentCount, 1, "Payment is created before subscription fails");
    });

    it("1.4 duplicate checkout does not create duplicates", async () => {
      await createTestUser(TEST_EMAIL);
      const payload = buildCheckoutPayload();

      await sendWebhook(getBaseUrl(), "checkout.completed", payload);
      await sendWebhook(getBaseUrl(), "checkout.completed", payload);

      const subCount = await Subscription.countDocuments();
      assert.equal(subCount, 1, "Should have exactly 1 subscription");

      const paymentCount = await Payment.countDocuments();
      assert.equal(paymentCount, 1, "Should have exactly 1 payment");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /Users/egorzozula/Desktop/BackendTemplate && npm test
```

Expected: All 4 tests in Group 1 PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/billing/__tests__/billing.test.js
git commit -m "test(billing): add checkout.completed integration tests (group 1)"
```

---

### Task 6: Write Group 2 tests — Renewal (`subscription.paid`)

**Files:**
- Modify: `src/modules/billing/__tests__/billing.test.js`

- [ ] **Step 1: Add Group 2 tests after the `checkout.completed` describe block**

Add these imports at the top if not present:

```js
import {
  createActiveSubscription,
  buildRenewalPayload,
} from "./helpers.js";
```

Add inside the `describe("Billing webhooks", ...)` block, after the `checkout.completed` describe:

```js
  // ── Group 2: Renewal (subscription.paid) ─────────────────────────────────

  describe("subscription.paid", () => {
    it("2.1 updates existing subscription without duplication", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);
      const payload = buildRenewalPayload();

      const res = await sendWebhook(getBaseUrl(), "subscription.paid", payload);
      assert.equal(res.statusCode, 200);

      const subCount = await Subscription.countDocuments();
      assert.equal(subCount, 1, "Should still have exactly 1 subscription");

      const sub = await Subscription.findOne({ providerSubscriptionId: TEST_SUBSCRIPTION_ID });
      assert.equal(sub.status, "active");
    });

    it("2.2 updates billing period dates", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);

      const newPeriodStart = "2026-04-01T00:00:00Z";
      const newPeriodEnd = "2026-05-01T00:00:00Z";
      const payload = buildRenewalPayload({
        current_period_start_date: newPeriodStart,
        current_period_end_date: newPeriodEnd,
      });

      await sendWebhook(getBaseUrl(), "subscription.paid", payload);

      const sub = await Subscription.findOne({ providerSubscriptionId: TEST_SUBSCRIPTION_ID });
      assert.equal(sub.currentPeriodStart.toISOString(), new Date(newPeriodStart).toISOString());
      assert.equal(sub.currentPeriodEnd.toISOString(), new Date(newPeriodEnd).toISOString());
    });

    it("2.3 creates renewal payment record", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);
      const payload = buildRenewalPayload();

      await sendWebhook(getBaseUrl(), "subscription.paid", payload);

      const payment = await Payment.findOne({ eventType: "subscription.paid" });
      assert.ok(payment, "Renewal payment should exist in DB");
      assert.equal(payment.amount, 2900);
      assert.equal(payment.currency, "USD");
    });
  });
```

- [ ] **Step 2: Run tests to verify all pass**

```bash
cd /Users/egorzozula/Desktop/BackendTemplate && npm test
```

Expected: All 7 tests PASS (4 from Group 1 + 3 from Group 2).

- [ ] **Step 3: Commit**

```bash
git add src/modules/billing/__tests__/billing.test.js
git commit -m "test(billing): add subscription.paid renewal integration tests (group 2)"
```

---

### Task 7: Write Group 3 tests — Cancellation (`subscription.canceled`)

**Files:**
- Modify: `src/modules/billing/__tests__/billing.test.js`

- [ ] **Step 1: Add Group 3 tests after the `subscription.paid` describe block**

Add this import at the top if not present:

```js
import { buildSubscriptionEventPayload } from "./helpers.js";
```

Add inside the `describe("Billing webhooks", ...)` block:

```js
  // ── Group 3: Cancellation (subscription.canceled) ────────────────────────

  describe("subscription.canceled", () => {
    it("3.1 sets status to canceled", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);

      const payload = buildSubscriptionEventPayload({
        canceled_at: "2026-04-01T00:00:00Z",
        status: "canceled",
      });

      const res = await sendWebhook(getBaseUrl(), "subscription.canceled", payload);
      assert.equal(res.statusCode, 200);

      const sub = await Subscription.findOne({ providerSubscriptionId: TEST_SUBSCRIPTION_ID });
      assert.equal(sub.status, "canceled");
    });

    it("3.2 scheduled_cancel then canceled flow", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);

      // Step 1: scheduled_cancel — still access-granting
      const scheduledPayload = buildSubscriptionEventPayload({
        canceled_at: "2026-04-01T00:00:00Z",
        status: "scheduled_cancel",
      });
      await sendWebhook(getBaseUrl(), "subscription.scheduled_cancel", scheduledPayload);

      const subAfterScheduled = await Subscription.findOne({
        providerSubscriptionId: TEST_SUBSCRIPTION_ID,
      });
      assert.equal(subAfterScheduled.status, "scheduled_cancel");

      // Step 2: canceled — no longer access-granting
      const canceledPayload = buildSubscriptionEventPayload({
        canceled_at: "2026-04-01T00:00:00Z",
        status: "canceled",
      });
      await sendWebhook(getBaseUrl(), "subscription.canceled", canceledPayload);

      const subAfterCanceled = await Subscription.findOne({
        providerSubscriptionId: TEST_SUBSCRIPTION_ID,
      });
      assert.equal(subAfterCanceled.status, "canceled");
    });

    it("3.3 canceled subscription not returned as active", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);

      const payload = buildSubscriptionEventPayload({
        canceled_at: "2026-04-01T00:00:00Z",
        status: "canceled",
      });
      await sendWebhook(getBaseUrl(), "subscription.canceled", payload);

      // Use the real repository function to check
      const { getActiveSubscriptionByUserId } = await import(
        "../repository/subscriptionRepository.js"
      );
      const activeSub = await getActiveSubscriptionByUserId(user._id);
      assert.equal(activeSub, null, "Canceled subscription should not be returned as active");
    });
  });
```

- [ ] **Step 2: Run all tests to verify they pass**

```bash
cd /Users/egorzozula/Desktop/BackendTemplate && npm test
```

Expected: All 10 tests PASS (4 + 3 + 3).

- [ ] **Step 3: Commit**

```bash
git add src/modules/billing/__tests__/billing.test.js
git commit -m "test(billing): add subscription cancellation integration tests (group 3)"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite one final time**

```bash
cd /Users/egorzozula/Desktop/BackendTemplate && npm test
```

Expected output: 10 tests passing across 3 describe blocks.

- [ ] **Step 2: Verify no leftover processes**

```bash
lsof -i :0 | grep node || echo "No leftover node processes"
```

- [ ] **Step 3: Final commit with all files**

If any files were missed:

```bash
cd /Users/egorzozula/Desktop/BackendTemplate && git status
```

All test files should already be committed from previous tasks.
