# Billing Product Separation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate subscription products from one-time products into distinct configs, models, processing flows, and access resolution.

**Architecture:** Two product types (subscriptions → plans, one-time → products) with separate configs, separate models (`Subscription` vs `Order`), separate checkout handlers, and a unified access resolver (`getUserBillingProfile`) that merges plan features/limits with product features/limits.

**Tech Stack:** Node.js, Express 5, MongoDB/Mongoose, Ramda

**Spec:** `docs/superpowers/specs/2026-03-20-billing-product-separation-design.md`

---

### Task 1: Config — Split PRODUCT_PLANS into separate configs

**Files:**
- Modify: `src/modules/billing/constants/billing.js:1-8`

- [ ] **Step 1: Replace PRODUCT_PLANS with three configs**

Replace lines 1-8 in `constants/billing.js`:

```js
// ── Subscription products → plan key ─────────────────────────────────────────
// Provider product IDs for recurring subscriptions
// Add new subscription products here as they are created in the billing provider dashboard

export const SUBSCRIPTION_PRODUCTS = {
  prod_TkVdhx4EhreepQ0TwmrrL: "pro",
};

// ── One-time products → product key ──────────────────────────────────────────
// Provider product IDs for one-time purchases
// Add new one-time products here as they are created in the billing provider dashboard

export const ONE_TIME_PRODUCTS = {
  prod_4tHvpNEWtUFrf8LaGBqyh8: "export_pack",
};

// ── Product definitions (features/limits each product grants) ────────────────
// Each product grants specific features and limits on top of the user's base plan

export const PRODUCTS = {
  export_pack: {
    name: "Export Pack",
    features: { export: true },
    limits: { storage: 5000 },
  },
};
```

- [ ] **Step 2: Verify syntax**

Run: `node --check src/modules/billing/constants/billing.js`
Expected: no output (success)

- [ ] **Step 3: Commit**

```bash
git add src/modules/billing/constants/billing.js
git commit -m "refactor(billing): split PRODUCT_PLANS into SUBSCRIPTION_PRODUCTS, ONE_TIME_PRODUCTS, PRODUCTS"
```

---

### Task 2: Order model and repository

**Files:**
- Create: `src/modules/billing/model/Order.js`
- Create: `src/modules/billing/repository/orderRepository.js`
- Modify: `src/modules/billing/dto/billingDto.js`

- [ ] **Step 1: Create Order model**

Create `src/modules/billing/model/Order.js`:

```js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId:            { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    providerOrderId:   { type: String, required: true, unique: true },
    productKey:        { type: String, required: true },
    providerProductId: { type: String, required: true },
    amount:            { type: Number },
    currency:          { type: String },
    providerPayload:   { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

orderSchema.index({ userId: 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
```

- [ ] **Step 2: Add orderToDTO in billingDto.js**

Add to `src/modules/billing/dto/billingDto.js` after `paymentToDTO`:

```js
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
```

Update export to include `orderToDTO`.

- [ ] **Step 3: Create orderRepository**

Create `src/modules/billing/repository/orderRepository.js`:

```js
import Order from "../model/Order.js";
import { orderToDTO } from "../dto/billingDto.js";

const createOrder = async (data) => {
  const doc = await Order.create(data);
  return orderToDTO(doc);
};

const getOrdersByUserId = async (userId) => {
  const docs = await Order.find({ userId }).sort({ createdAt: -1 });
  return docs.map(orderToDTO);
};

export { createOrder, getOrdersByUserId };
```

- [ ] **Step 4: Verify syntax**

Run: `node --check src/modules/billing/model/Order.js && node --check src/modules/billing/repository/orderRepository.js && node --check src/modules/billing/dto/billingDto.js`
Expected: no output (success)

- [ ] **Step 5: Commit**

```bash
git add src/modules/billing/model/Order.js src/modules/billing/repository/orderRepository.js src/modules/billing/dto/billingDto.js
git commit -m "feat(billing): add Order model, repository, and DTO for one-time products"
```

---

### Task 3: Split checkout processing in billingServices.js

**Files:**
- Modify: `src/modules/billing/services/billingServices.js`

- [ ] **Step 1: Update imports**

Replace import of `resolvePlanKey` and add new imports:

```js
import { resolveSubscriptionPlanKey, resolveProductKey } from "./planServices.js";
import { createOrder } from "../repository/orderRepository.js";
```

Remove: `import { resolvePlanKey } from "./planServices.js";`

- [ ] **Step 2: Rename processCheckoutCompleted → processSubscriptionCheckout**

Update the existing `processCheckoutCompleted` function. Change `resolvePlanKey` → `resolveSubscriptionPlanKey`. Keep the same logic but only handle subscription products:

```js
const processSubscriptionCheckout = async (data) => {
  const user = await getUser({ email: data.customer_email });
  const userId = user ? user.id : null;
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

  if (user) {
    await tryRunHook(planKey, "onActivate", user, subscription);
  }
};
```

- [ ] **Step 3: Add processOrderCheckout**

```js
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
```

- [ ] **Step 4: Add createOrderSafe helper** (idempotent, like createPaymentSafe)

```js
const createOrderSafe = async (orderData) => {
  try {
    return await createOrder(orderData);
  } catch (error) {
    if (isDuplicateKeyError(error)) return null;
    throw error;
  }
};
```

- [ ] **Step 5: Add processCheckoutCompleted router**

Replace the old `processCheckoutCompleted` with a router that dispatches by product type:

```js
const processCheckoutCompleted = async (data) => {
  if (SUBSCRIPTION_PRODUCTS[data.product_id]) {
    return processSubscriptionCheckout(data);
  }
  if (ONE_TIME_PRODUCTS[data.product_id]) {
    return processOrderCheckout(data);
  }
};
```

Add import at top: `import { SUBSCRIPTION_PRODUCTS, ONE_TIME_PRODUCTS } from "../constants/billing.js";`

- [ ] **Step 6: Remove isSubscriptionProduct helper**

Delete the `isSubscriptionProduct` function (line 15). It is no longer needed — routing is now by product config, not by `subscription_id` presence. Update `buildPaymentRecord` to determine type from config:

```js
const getPaymentType = (productId) =>
  SUBSCRIPTION_PRODUCTS[productId] ? "subscription" : "one_time";

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
```

- [ ] **Step 7: Verify syntax**

Run: `node --check src/modules/billing/services/billingServices.js`
Expected: no output (success)

- [ ] **Step 8: Commit**

```bash
git add src/modules/billing/services/billingServices.js
git commit -m "refactor(billing): split processCheckoutCompleted into subscription and order handlers"
```

---

### Task 4: Update planServices.js — getUserBillingProfile + merge logic

**Files:**
- Modify: `src/modules/billing/services/planServices.js`

- [ ] **Step 1: Update imports**

Replace `getOneTimePurchasesByUserId` import with `getOrdersByUserId`:

```js
import { getOrdersByUserId } from "../repository/orderRepository.js";
```

Remove: `import { getOneTimePurchasesByUserId } from "../repository/paymentRepository.js";`

Add `PRODUCTS` to constants import:

```js
import {
  SUBSCRIPTION_PRODUCTS,
  ONE_TIME_PRODUCTS,
  PRODUCTS,
  PLAN_HIERARCHY,
  PLANS,
} from "../constants/billing.js";
```

- [ ] **Step 2: Replace resolvePlanKey with two functions**

```js
const resolveSubscriptionPlanKey = (productId) => SUBSCRIPTION_PRODUCTS[productId] || "free";

const resolveProductKey = (productId) => ONE_TIME_PRODUCTS[productId] || null;

const getProductConfig = (productKey) => PRODUCTS[productKey] || null;
```

Remove old `resolvePlanKey`.

- [ ] **Step 3: Add merge functions**

```js
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
```

- [ ] **Step 4: Replace getUserPlan with getUserBillingProfile**

```js
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
```

- [ ] **Step 5: Remove old functions**

Remove: `resolvePlanKey`, `pickHigherPlan`, `pickHigherPlanFromPayment`, `resolveBestPlanKey`.

- [ ] **Step 6: Update userHasFeature and getUserLimit**

Replace `getUserPlan` calls with `getUserBillingProfile`:

```js
const userHasFeature = async (userId, featureName) => {
  const profile = await getUserBillingProfile(userId);
  return planHasFeature(profile, featureName);
};

const getUserLimit = async (userId, limitName) => {
  const profile = await getUserBillingProfile(userId);
  return getPlanLimit(profile, limitName);
};
```

- [ ] **Step 7: Update exports**

```js
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
```

- [ ] **Step 8: Verify syntax**

Run: `node --check src/modules/billing/services/planServices.js`
Expected: no output (success)

- [ ] **Step 9: Commit**

```bash
git add src/modules/billing/services/planServices.js
git commit -m "refactor(billing): replace getUserPlan with getUserBillingProfile, add feature/limit merging"
```

---

### Task 5: Update paymentRepository — remove one-time purchase functions

**Files:**
- Modify: `src/modules/billing/repository/paymentRepository.js:16-23`

- [ ] **Step 1: Remove getOneTimePurchasesByUserId and hasOneTimePurchase**

Remove functions `hasOneTimePurchase` (lines 16-18) and `getOneTimePurchasesByUserId` (lines 20-23).

Update export:

```js
export { createPayment, getPaymentsByUserId };
```

- [ ] **Step 2: Verify syntax**

Run: `node --check src/modules/billing/repository/paymentRepository.js`
Expected: no output (success)

- [ ] **Step 3: Commit**

```bash
git add src/modules/billing/repository/paymentRepository.js
git commit -m "refactor(billing): remove one-time purchase functions from paymentRepository (moved to orderRepository)"
```

---

### Task 6: Update middleware, controller, routes, index

**Files:**
- Modify: `src/modules/billing/middleware/plan.js`
- Modify: `src/modules/billing/controller/billingController.js`
- Modify: `src/modules/billing/routes/billingRoutes.js`
- Modify: `src/modules/billing/index.js`

- [ ] **Step 1: Update middleware/plan.js**

Replace import:

```js
import { getUserBillingProfile, planHasFeature } from "../services/planServices.js";
```

Replace all `getUserPlan` calls with `getUserBillingProfile` inside `ensurePlan`:

```js
const ensurePlan = async (req) => {
  if (!req.plan) {
    req.plan = await getUserBillingProfile(req.user.id);
  }
  return req.plan;
};
```

- [ ] **Step 2: Update controller/billingController.js**

Replace `getUserPlan` import:

```js
import { getUserBillingProfile } from "../services/planServices.js";
```

Add import for orders:

```js
import { getOrdersByUserId } from "../repository/orderRepository.js";
```

Update `getPlan` handler:

```js
const getPlan = async (req, res) => {
  try {
    const profile = await getUserBillingProfile(req.user.id);
    httpResponse(res, generalStatus.SUCCESS, profile);
  } catch (error) {
    httpResponseError(res, error);
  }
};
```

Add `getOrders` handler:

```js
const getOrders = async (req, res) => {
  try {
    const orders = await getOrdersByUserId(req.user.id);
    httpResponse(res, generalStatus.SUCCESS, orders);
  } catch (error) {
    httpResponseError(res, error);
  }
};
```

Update export to include `getOrders`:

```js
export { handleWebhook, getPlan, getSubscription, getPayments, getOrders, cancelSubscription };
```

- [ ] **Step 3: Update routes/billingRoutes.js**

Add `getOrders` to import:

```js
import { handleWebhook, getPlan, getSubscription, getPayments, getOrders, cancelSubscription } from "../controller/billingController.js";
```

Add route:

```js
router.get("/orders", authMiddleware, getOrders);
```

- [ ] **Step 4: Update index.js**

```js
export { requireFeature, requirePlan, attachPlan } from "./middleware/plan.js";
export { getUserBillingProfile } from "./services/planServices.js";
export { default as billingRouter } from "./routes/billingRoutes.js";
```

- [ ] **Step 5: Verify all syntax**

Run: `node --check src/modules/billing/middleware/plan.js && node --check src/modules/billing/controller/billingController.js && node --check src/modules/billing/routes/billingRoutes.js && node --check src/modules/billing/index.js`
Expected: no output (success)

- [ ] **Step 6: Check for remaining getUserPlan references**

Run: `grep -r "getUserPlan" src/`
Expected: no matches (all replaced with `getUserBillingProfile`)

- [ ] **Step 7: Check for remaining PRODUCT_PLANS references**

Run: `grep -r "PRODUCT_PLANS" src/`
Expected: no matches (all replaced with `SUBSCRIPTION_PRODUCTS` / `ONE_TIME_PRODUCTS`)

- [ ] **Step 8: Commit**

```bash
git add src/modules/billing/middleware/plan.js src/modules/billing/controller/billingController.js src/modules/billing/routes/billingRoutes.js src/modules/billing/index.js
git commit -m "refactor(billing): update middleware, controller, routes, index for product separation"
```

---

### Task 7: Frontend updates

**Files:**
- Modify: `/Users/egorzozula/Desktop/Template-frontend/services/configs/billing.config.ts`

- [ ] **Step 1: Add products field to Plan interface**

```ts
interface Plan {
	key: 'free' | 'starter' | 'pro'
	features: { dashboard: boolean; export: boolean; apiAccess: boolean }
	limits: { projects: number; storage: number }
	products: string[]
}
```

- [ ] **Step 2: Add BillingOrder interface**

```ts
interface BillingOrder {
	id: string
	userId: string
	providerOrderId: string
	productKey: string
	providerProductId: string
	amount: number
	currency: string
	createdAt: string
	updatedAt: string
}
```

- [ ] **Step 3: Add orders endpoint**

```ts
orders: endpoint<void, ApiResponse<BillingOrder[]>>({
	url: () => `/api/billing/orders`,
	method: getData,
	defaultErrorMessage: 'Failed to fetch orders',
}),
```

- [ ] **Step 4: Update exports**

Add `BillingOrder` to the type exports.

- [ ] **Step 5: Commit**

```bash
cd /Users/egorzozula/Desktop/Template-frontend
git add services/configs/billing.config.ts
git commit -m "feat(billing): add products to Plan type, add BillingOrder interface and orders endpoint"
```

---

### Task 8: Final verification

**Files:** All modified files

- [ ] **Step 1: Full syntax check**

Run: `node --check src/modules/billing/constants/billing.js && node --check src/modules/billing/model/Order.js && node --check src/modules/billing/repository/orderRepository.js && node --check src/modules/billing/dto/billingDto.js && node --check src/modules/billing/services/billingServices.js && node --check src/modules/billing/services/planServices.js && node --check src/modules/billing/repository/paymentRepository.js && node --check src/modules/billing/middleware/plan.js && node --check src/modules/billing/controller/billingController.js && node --check src/modules/billing/routes/billingRoutes.js && node --check src/modules/billing/index.js`
Expected: no output (all pass)

- [ ] **Step 2: Check no remaining old references**

Run: `grep -r "PRODUCT_PLANS\|getUserPlan\|resolvePlanKey\|getOneTimePurchasesByUserId\|hasOneTimePurchase\|isSubscriptionProduct" src/modules/billing/`
Expected: no matches

- [ ] **Step 3: Check no creem references outside provider**

Run: `grep -r "creem" src/modules/billing/ --include="*.js" | grep -v "providers/"`
Expected: no matches (only provider files should reference creem)
