# Billing: Separate Subscriptions and One-Time Products

## Problem

All billing products (subscriptions and one-time purchases) share a single config (`PRODUCT_PLANS`), a single processing flow (`processCheckoutCompleted`), and one-time purchases have no dedicated model. This makes the code harder to reason about and extend.

## Behavioral Change

Currently one-time purchases grant **plan-level access** (e.g., buying `prod_4tHvpNEWtUFrf8LaGBqyh8` gives the full "starter" plan). After this change, one-time purchases become **additive products** — each grants specific features/limits on top of the user's base subscription plan.

This is an intentional change. Existing `Payment` records with `type: "one_time"` must be migrated to `Order` documents to preserve access.

## Design

### Config (`constants/billing.js`)

Replace single `PRODUCT_PLANS` with three separate configs:

```js
// ── Subscription products → plan key ─────────────────────────────────────────
const SUBSCRIPTION_PRODUCTS = {
  prod_TkVdhx4EhreepQ0TwmrrL: "pro",
};

// ── One-time products → product key ──────────────────────────────────────────
const ONE_TIME_PRODUCTS = {
  prod_4tHvpNEWtUFrf8LaGBqyh8: "export_pack",
};

// ── Product definitions (features/limits each product grants) ────────────────
const PRODUCTS = {
  export_pack: {
    name: "Export Pack",
    features: { export: true },
    limits: { storage: 5000 },
  },
};
```

`PLANS` remains unchanged — describes base subscription plans (free, starter, pro).

Remove `PRODUCT_PLANS` entirely.

### Plan/Product Resolution Functions

Split `resolvePlanKey` into two functions:

- `resolveSubscriptionPlanKey(productId)` — looks up `SUBSCRIPTION_PRODUCTS[productId]`, falls back to `"free"`
- `resolveProductKey(productId)` — looks up `ONE_TIME_PRODUCTS[productId]`, returns `null` if not found
- `getProductConfig(productKey)` — looks up `PRODUCTS[productKey]`

### Models

**`Order` (new model)** — records a purchased one-time product:

| Field | Type | Description |
|---|---|---|
| userId | ObjectId | Buyer |
| providerOrderId | String (unique) | Idempotency key, maps from normalized `data.id` |
| productKey | String | Internal key ("export_pack") |
| providerProductId | String | Provider product ID |
| amount | Number | Price in cents |
| currency | String | ISO currency |
| providerPayload | Mixed | Raw provider data |

Indexes: `{ userId: 1 }` for querying user's orders. Duplicate purchase: `providerOrderId` is unique (idempotent), but a user CAN buy the same `productKey` multiple times (no unique constraint on `userId + productKey`).

**`Subscription`** — unchanged.

**`Payment`** — unchanged (append-only financial log for both types, keeps `type: "subscription" | "one_time"`). Both subscription and one-time checkouts create a Payment record for financial history.

### Webhook Processing

`processCheckoutCompleted` splits into two handlers based on product type:

```
checkout.completed webhook arrives
  → product_id in SUBSCRIPTION_PRODUCTS? → processSubscriptionCheckout
     → creates Subscription + Payment (uses resolveSubscriptionPlanKey)
  → product_id in ONE_TIME_PRODUCTS? → processOrderCheckout
     → creates Order + Payment (uses resolveProductKey)
  → neither → log and skip
```

Two clean handlers, each knows only its own type. Payment is created in both as the financial log.

Subscription events (`subscription.paid`, `subscription.canceled`, etc.) are unaffected.

Refund handling for one-time products: current `processRefund` creates a Payment record but does not revoke access. This behavior is preserved — refunds remain financial-only. Order revocation is out of scope.

### Access Resolver (`planServices.js`)

Replace `getUserPlan()` with `getUserBillingProfile(userId)`:

1. Get base plan from active subscription (or "free" if none)
2. Get all purchased products from `Order` collection via `orderRepository`
3. Merge: plan features/limits + all product features/limits
   - `mergeFeatures(planFeatures, productConfigs)` — OR logic (if any source grants `true`, feature is available)
   - `mergeLimits(planLimits, productConfigs)` — MAX logic (highest value from any source wins)
4. Return:

```js
{
  key: "pro",
  features: { dashboard: true, export: true, apiAccess: true },
  limits: { projects: Infinity, storage: 50000 },
  products: ["export_pack"],
}
```

Remove `resolveBestPlanKey`, `pickHigherPlanFromPayment`, `pickHigherPlan` — no longer needed (one-time purchases are not plans).

### Middleware

`requireFeature`, `requirePlan`, `attachPlan` — unchanged in interface, internally call `getUserBillingProfile()` instead of `getUserPlan()`.

Note: `requirePlan("starter")` checks plan hierarchy. A user on "free" plan + "export_pack" product will pass `requireFeature("export")` but fail `requirePlan("starter")`. This is intentional — `requirePlan` checks the subscription tier, `requireFeature` checks actual access.

### Hooks

`hooks/productHooks.js` — unchanged. Hooks are for subscription lifecycle events (onActivate, onDeactivate, onRenew). One-time products do not trigger hooks. If product-specific hooks are needed later, a separate `productHooks` system can be added.

### API Routes

`GET /api/billing/plan` — route path stays the same, internally calls `getUserBillingProfile()`. Response shape adds `products` array:

```js
// Before
{ key: "pro", features: {...}, limits: {...} }

// After
{ key: "pro", features: {...}, limits: {...}, products: ["export_pack"] }
```

This is additive and non-breaking for existing frontend consumers.

New endpoint: `GET /api/billing/orders` — returns user's one-time purchases.

### New Files

| File | Purpose |
|---|---|
| `model/Order.js` | Mongoose schema for one-time purchases |
| `repository/orderRepository.js` | `createOrder`, `getOrdersByUserId` |

### Modified Files

| File | Change |
|---|---|
| `constants/billing.js` | Remove `PRODUCT_PLANS`. Add `SUBSCRIPTION_PRODUCTS`, `ONE_TIME_PRODUCTS`, `PRODUCTS` |
| `services/billingServices.js` | Split `processCheckoutCompleted` → `processSubscriptionCheckout` + `processOrderCheckout`. Update `resolvePlanKey` → `resolveSubscriptionPlanKey` |
| `services/planServices.js` | `getUserPlan` → `getUserBillingProfile`. Remove `resolveBestPlanKey`, `pickHigherPlan`, `pickHigherPlanFromPayment`. Add `mergeFeatures`, `mergeLimits`, `resolveProductKey`, `getProductConfig`. Split `resolvePlanKey` → `resolveSubscriptionPlanKey` |
| `repository/paymentRepository.js` | Remove `getOneTimePurchasesByUserId`, `hasOneTimePurchase` (replaced by `orderRepository`) |
| `dto/billingDto.js` | Add `orderToDTO(doc)` with fields: `id, userId, providerOrderId, productKey, providerProductId, amount, currency, createdAt, updatedAt` |
| `controller/billingController.js` | Rename `getUserPlan` import → `getUserBillingProfile`. Add `getOrders` handler |
| `routes/billingRoutes.js` | Add `GET /orders` route |
| `middleware/plan.js` | Call `getUserBillingProfile` instead of `getUserPlan` |
| `index.js` | Update exports: `getUserPlan` → `getUserBillingProfile`. Add `getOrdersByUserId` if needed by other modules |

### Frontend

- `Plan` TypeScript interface — add `products: string[]` field
- Plans displayed as subscription cards with Upgrade/Cancel (existing)
- Purchased products displayed as separate "Your products" section (new)
- Add `PRODUCT_DETAILS` config for product display info
- Add `billingApi.orders` endpoint config for `GET /api/billing/orders`

### Migration

Existing `Payment` records with `type: "one_time"` need to be backfilled into `Order` documents. Migration script:

1. Query `Payment.find({ type: "one_time" })`
2. For each, create an `Order` with: `userId`, `providerOrderId: payment.providerEventId`, `productKey: resolveProductKey(payment.productId)`, `providerProductId: payment.productId`, `amount`, `currency`
3. Skip if `providerOrderId` already exists in Order (idempotent)

### What Does NOT Change

- Provider contract (`parseWebhookEvent`, `cancelSubscription`, `signatureHeader`)
- Webhook signature verification
- Payment model (append-only financial log)
- Subscription event processing (`processSubscriptionEvent`)
- `Subscription` model
- Product hooks (subscription lifecycle only)
