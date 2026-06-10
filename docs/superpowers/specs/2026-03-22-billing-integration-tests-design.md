# Billing Integration Tests — Design Spec

## Goal

Integration tests for the billing module that verify the full webhook-to-database flow:

1. When `checkout.completed` arrives — user gets an active subscription
2. When `subscription.paid` arrives — existing subscription is renewed (not duplicated)
3. When `subscription.canceled` arrives — subscription becomes inactive

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Test runner | `node:test` (built-in) | Zero dependencies, project uses ES modules |
| Database | `mongodb-memory-server` | Real MongoDB queries, no Docker, isolated |
| Test level | HTTP integration (Express + Supertest-like) | Tests the real path: HTTP request → controller → service → DB |
| Signature verification | Mocked out | Focus on business logic, not crypto verification |
| Other mocks | None | Real DB, real services, real repositories, real hooks |

## Infrastructure

### Dependencies

```
mongodb-memory-server  — in-memory MongoDB instance
```

No test runner packages needed — `node:test` + `node:assert` are built-in.

### File Structure

```
src/modules/billing/
└── __tests__/
    ├── setup.js           — MongoMemoryServer lifecycle, Express app assembly
    ├── helpers.js          — webhook payload factories, HTTP helper, test user creation
    └── billing.test.js     — all test cases
```

### Setup Lifecycle

- `before()` — start MongoMemoryServer, connect mongoose, build Express app with billing routes
- `afterEach()` — drop all collections between tests
- `after()` — stop MongoMemoryServer, disconnect mongoose

### Environment Variables

Before any billing module is imported, set test env vars:

```js
process.env.CREEM_PRODUCT_PRO = "test_product_pro";
process.env.CREEM_PRODUCT_EXPORT_PACK = "test_product_export_pack";
```

This is required because `SUBSCRIPTION_PRODUCTS` and `ONE_TIME_PRODUCTS` in `constants/billing.js` are built from `process.env` at module load time. Without these values, product ID lookup silently fails and no subscription is created. Webhook payloads in tests must use these same values.

`CREEM_API_KEY` and `CREEM_WEBHOOK_SECRET` are NOT needed because the provider module is fully replaced by a mock.

### Express App Assembly

Build a minimal Express app for tests (not the full `app.js`):

1. `express.raw({ type: "application/json" })` on `/billing/webhook` — **MUST be registered before `express.json()`**, matching production order in `app.js:15-16`. If reversed, `req.body` will be a parsed JSON object instead of a Buffer, and `req.body.toString("utf-8")` in the controller will produce `"[object Object]"`.
2. `express.json()` for other routes
3. Mount billing routes on `/billing`
4. No CORS, no cookie-parser (not needed for webhook tests)

### Provider Mock

The only mock: replace the entire `providers/creem.js` module to skip HMAC signature verification.

**Why full module replacement:** The controller resolves `const provider = billingProviders.getProvider()` at top-level module scope (line 11 of `billingController.js`). Also, `creem.js` reads `CREEM_WEBHOOK_SECRET` from `process.env` at load time — without it, `verifySignature` will crash on `crypto.createHmac("sha256", undefined)`. Patching after import does not work reliably with ES modules.

**Implementation:** Use `mock.module()` from `node:test` (available since Node 22.3) to replace `../providers/creem.js` before the controller is imported. The mock provider:

1. Exports `signatureHeader: "creem-signature"`
2. Exports `parseWebhookEvent(rawBody, _signature)` that skips signature verification, parses JSON, and runs the same normalizer logic
3. Exports a stub `cancelSubscription` that throws (not tested)

**Required Node version:** 22.3+ for `mock.module()`. Add `--experimental-test-module-mocks` flag if needed by your Node version.

## Test Cases

### Group 1: New Subscription (`checkout.completed`) — 3 tests

**1.1 Creates subscription with active status**
- Send webhook `checkout.completed` with a subscription product ID
- Assert: Subscription document exists in DB with `status: "active"`, correct `planKey: "pro"`, correct `providerSubscriptionId`

**1.2 Creates payment record**
- Send webhook `checkout.completed`
- Assert: Payment document exists with `type: "subscription"`, `eventType: "checkout.completed"`, correct `amount` and `currency`

**1.3 Rejects webhook when user not found**
- Send webhook `checkout.completed` with an email that has no matching user in DB
- Assert: Webhook returns 500 (Mongoose validation error because `Subscription.userId` is `required: true`)
- Assert: No Subscription document created in DB
- Assert: 1 Payment document exists (payment is created before subscription save, and `Payment.userId` is not required — so the payment succeeds with `userId: null` before the subscription fails)
- Note: This test documents current behavior — the model requires `userId`. If we later want to support unknown-user webhooks, both the model (`required: false`) and the DTO (`userId.toString()` crashes on null) need changes.

**1.4 Duplicate checkout does not create duplicates**
- Send the same `checkout.completed` webhook twice with identical payloads (same `subscription_id` and same `order.id` — `order.id` becomes `providerEventId` via the normalizer)
- Assert: Still only 1 Subscription and 1 Payment document in DB (upsert + idempotent payment creation)

### Group 2: Renewal (`subscription.paid`) — 3 tests

**2.1 Updates existing subscription (no duplication)**
- Pre-create an active subscription in DB
- Send webhook `subscription.paid` with same `subscription_id`
- Assert: Still only 1 Subscription document in DB, status remains `active`

**2.2 Updates billing period**
- Pre-create an active subscription
- Send webhook `subscription.paid` with new `current_period_start` and `current_period_end`
- Assert: Subscription's period dates updated to new values

**2.3 Creates renewal payment**
- Pre-create an active subscription
- Send webhook `subscription.paid`
- Assert: New Payment document created with `eventType: "subscription.paid"`

### Group 3: Cancellation (`subscription.canceled`) — 3 tests

**3.1 Sets status to canceled**
- Pre-create an active subscription
- Send webhook `subscription.canceled`
- Assert: Subscription status is `canceled`

**3.2 Scheduled cancel → canceled flow**
- Pre-create an active subscription
- Send webhook `subscription.scheduled_cancel` → assert status `scheduled_cancel` (still access-granting)
- Send webhook `subscription.canceled` → assert status `canceled` (no longer access-granting)

**3.3 Canceled subscription not returned as active**
- Pre-create an active subscription, cancel it via webhook
- Query `getActiveSubscriptionByUserId(userId)`
- Assert: returns `null`

## Helpers

### `createTestUser(email)`

Creates a User document directly in MongoDB. Returns the user object with `_id`. Needed because `processSubscriptionCheckout` looks up users by email via `getUser({ email })`.

### `buildWebhookPayload(eventType, data)`

Builds a Creem-like webhook envelope:

```js
{ eventType: "checkout.completed", object: { ...data } }
```

**Minimum required fields per event type:**

| Event | Required fields |
|-------|----------------|
| `checkout.completed` | `order.id`, `order.amount`, `order.currency`, `subscription` (string or `{ id }`), `customer.email`, `product` (string or `{ id }`) |
| `subscription.paid` | `id` (= subscription_id), `product`, `customer`, `current_period_start_date`, `current_period_end_date`, `last_transaction.order`, `last_transaction.amount`, `last_transaction.currency` |
| `subscription.canceled` | `id`, `product`, `customer`, `current_period_start_date`, `current_period_end_date`, `canceled_at` |
| `subscription.scheduled_cancel` | `id`, `product`, `customer`, `current_period_start_date`, `current_period_end_date`, `canceled_at` |

### `sendWebhook(app, eventType, data)`

Sends `POST /billing/webhook` with:
- Header: `creem-signature: "test"`
- Header: `Content-Type: application/json`
- Body: raw JSON string (matches `express.raw()` middleware)

Returns the HTTP response for status code assertions.

### `createActiveSubscription(userId, overrides)`

Inserts a Subscription document directly in MongoDB with `status: "active"` and sensible defaults. Used by renewal and cancellation tests to avoid repeating the checkout flow.

## npm Script

Add to `package.json`:

```json
"scripts": {
  "test": "node --experimental-test-module-mocks --test src/modules/billing/__tests__/billing.test.js",
  "test:billing": "node --experimental-test-module-mocks --test src/modules/billing/__tests__/billing.test.js"
}
```

**Requires Node 22.3+** for `mock.module()` support.

## What Is NOT Tested

- HMAC signature verification (excluded by user decision)
- One-time product purchases (out of scope — focus on subscriptions)
- Auth-protected endpoints like `GET /billing/plan` (out of scope)
- Creem SDK calls for cancellation (`provider.cancelSubscription`) — would require mocking external API
- Frontend behavior
