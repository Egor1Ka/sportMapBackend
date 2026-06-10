# Creem Normalizers Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить один универсальный `normalizeSubscription` на 10 самостоятельных normalizer'ов — по одному на каждый тип Creem webhook события.

**Architecture:** Каждый normalizer — полностью независимая функция без общих хелперов. Маппинг `eventType → normalizer` через конфиг-объект `EVENT_NORMALIZERS`. Выходной формат (shape) не меняется — `billingServices.js` не затрагивается.

**Tech Stack:** Node.js, Creem SDK

**Spec:** `docs/superpowers/specs/2026-03-20-creem-normalizers-refactor-design.md`

---

### Task 1: Написать normalizeSubscriptionPayment

**Files:**
- Modify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Добавить функцию `normalizeSubscriptionPayment` после `normalizeCheckout`**

```js
// ── subscription.paid ────────────────────────────────────────────────────────
// Создаёт Payment запись при продлении подписки.
// ID = order ID из транзакции (дедуплицирует с checkout.completed для начального платежа).
// Фолбэки: transaction ID → subscription ID (если Creem не пришлёт order).
const normalizeSubscriptionPayment = (raw) => ({
  id: raw.last_transaction?.order || raw.last_transaction_id || raw.last_transaction?.id || raw.id,
  subscription_id: raw.id,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: raw.last_transaction?.amount,
  currency: raw.last_transaction?.currency,
  current_period_start: raw.current_period_start_date,
  current_period_end: raw.current_period_end_date,
  cancel_at: raw.canceled_at,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/billing/providers/creem.js
git commit -m "feat(billing): add normalizeSubscriptionPayment normalizer"
```

---

### Task 2: Написать normalizeSubscriptionActive

**Files:**
- Modify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Добавить функцию `normalizeSubscriptionActive` после `normalizeSubscriptionPayment`**

```js
// ── subscription.active ─────────────────────────────────────────────────────
// Обновление статуса подписки на "active". Платёжных данных нет.
const normalizeSubscriptionActive = (raw) => ({
  id: raw.id,
  subscription_id: raw.id,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: null,
  currency: null,
  current_period_start: raw.current_period_start_date,
  current_period_end: raw.current_period_end_date,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/billing/providers/creem.js
git commit -m "feat(billing): add normalizeSubscriptionActive normalizer"
```

---

### Task 3: Написать normalizeSubscriptionCanceled

**Files:**
- Modify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Добавить функцию `normalizeSubscriptionCanceled`**

```js
// ── subscription.canceled ───────────────────────────────────────────────────
// Подписка отменена. Платёжных данных нет.
const normalizeSubscriptionCanceled = (raw) => ({
  id: raw.id,
  subscription_id: raw.id,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: null,
  currency: null,
  current_period_start: raw.current_period_start_date,
  current_period_end: raw.current_period_end_date,
  cancel_at: raw.canceled_at,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/billing/providers/creem.js
git commit -m "feat(billing): add normalizeSubscriptionCanceled normalizer"
```

---

### Task 4: Написать normalizeSubscriptionExpired

**Files:**
- Modify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Добавить функцию `normalizeSubscriptionExpired`**

```js
// ── subscription.expired ────────────────────────────────────────────────────
// Подписка истекла (не продлена). Запускает onDeactivate хук.
const normalizeSubscriptionExpired = (raw) => ({
  id: raw.id,
  subscription_id: raw.id,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: null,
  currency: null,
  current_period_start: raw.current_period_start_date,
  current_period_end: raw.current_period_end_date,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/billing/providers/creem.js
git commit -m "feat(billing): add normalizeSubscriptionExpired normalizer"
```

---

### Task 5: Написать normalizeSubscriptionPaused

**Files:**
- Modify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Добавить функцию `normalizeSubscriptionPaused`**

```js
// ── subscription.paused ─────────────────────────────────────────────────────
// Подписка приостановлена.
const normalizeSubscriptionPaused = (raw) => ({
  id: raw.id,
  subscription_id: raw.id,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: null,
  currency: null,
  current_period_start: raw.current_period_start_date,
  current_period_end: raw.current_period_end_date,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/billing/providers/creem.js
git commit -m "feat(billing): add normalizeSubscriptionPaused normalizer"
```

---

### Task 6: Написать normalizeSubscriptionPastDue

**Files:**
- Modify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Добавить функцию `normalizeSubscriptionPastDue`**

```js
// ── subscription.past_due ───────────────────────────────────────────────────
// Оплата подписки просрочена.
const normalizeSubscriptionPastDue = (raw) => ({
  id: raw.id,
  subscription_id: raw.id,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: null,
  currency: null,
  current_period_start: raw.current_period_start_date,
  current_period_end: raw.current_period_end_date,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/billing/providers/creem.js
git commit -m "feat(billing): add normalizeSubscriptionPastDue normalizer"
```

---

### Task 7: Написать normalizeSubscriptionScheduledCancel

**Files:**
- Modify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Добавить функцию `normalizeSubscriptionScheduledCancel`**

```js
// ── subscription.scheduled_cancel ───────────────────────────────────────────
// Подписка запланирована к отмене в cancel_at.
const normalizeSubscriptionScheduledCancel = (raw) => ({
  id: raw.id,
  subscription_id: raw.id,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: null,
  currency: null,
  current_period_start: raw.current_period_start_date,
  current_period_end: raw.current_period_end_date,
  cancel_at: raw.canceled_at,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/billing/providers/creem.js
git commit -m "feat(billing): add normalizeSubscriptionScheduledCancel normalizer"
```

---

### Task 8: Написать normalizeRefund и normalizeDispute

**Files:**
- Modify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Добавить функцию `normalizeRefund`**

```js
// ── refund.created ──────────────────────────────────────────────────────────
// Возврат средств. Создаёт Payment запись для учёта.
const normalizeRefund = (raw) => ({
  id: raw.id,
  subscription_id: typeof raw.subscription === "object" && raw.subscription !== null ? raw.subscription.id : raw.subscription || null,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: raw.amount,
  currency: raw.currency,
  current_period_start: null,
  current_period_end: null,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 2: Добавить функцию `normalizeDispute`**

```js
// ── dispute.created ─────────────────────────────────────────────────────────
// Диспут (chargeback). Создаёт Payment запись для учёта.
const normalizeDispute = (raw) => ({
  id: raw.id,
  subscription_id: typeof raw.subscription === "object" && raw.subscription !== null ? raw.subscription.id : raw.subscription || null,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: raw.amount,
  currency: raw.currency,
  current_period_start: null,
  current_period_end: null,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/billing/providers/creem.js
git commit -m "feat(billing): add normalizeRefund and normalizeDispute normalizers"
```

---

### Task 9: Заменить маппинг и удалить старый код

**Files:**
- Modify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Заменить `CHECKOUT_EVENT` + `normalizeEventData` на `EVENT_NORMALIZERS`**

Удалить:
```js
const CHECKOUT_EVENT = "checkout.completed";

const normalizeEventData = (eventType, raw) =>
  eventType === CHECKOUT_EVENT
    ? normalizeCheckout(raw)
    : normalizeSubscription(raw);
```

Добавить:
```js
// ── Event type → normalizer ─────────────────────────────────────────────────

const EVENT_NORMALIZERS = {
  "checkout.completed":             normalizeCheckout,
  "subscription.paid":              normalizeSubscriptionPayment,
  "subscription.active":            normalizeSubscriptionActive,
  "subscription.canceled":          normalizeSubscriptionCanceled,
  "subscription.expired":           normalizeSubscriptionExpired,
  "subscription.paused":            normalizeSubscriptionPaused,
  "subscription.past_due":          normalizeSubscriptionPastDue,
  "subscription.scheduled_cancel":  normalizeSubscriptionScheduledCancel,
  "refund.created":                 normalizeRefund,
  "dispute.created":                normalizeDispute,
};
```

- [ ] **Step 2: Обновить `parseWebhookEvent` — использовать `EVENT_NORMALIZERS`**

```js
const parseWebhookEvent = (rawBody, signature) => {
  if (!verifySignature(rawBody, signature)) return null;

  const event = JSON.parse(rawBody);
  const eventType = event.eventType || event.event_type;
  const eventData = event.object || event.data || event;

  const normalize = EVENT_NORMALIZERS[eventType];

  if (!normalize) {
    return { eventType, data: eventData };
  }

  return {
    eventType,
    data: normalize(eventData),
  };
};
```

- [ ] **Step 3: Удалить старый `normalizeSubscription` и его комментарии (строки 50–72)**

Удалить полностью:
```js
// ── Normalize SubscriptionEntity → internal format ──────────────────────────
// Wire: { id, product, customer, last_transaction_id, last_transaction, ...

// Цепочка фолбэков для уникального ID события:
//   1. last_transaction.order  — ...
const normalizeSubscription = (raw) => ({ ... });
```

- [ ] **Step 4: Удалить хелперы `extractId` и `extractEmail` (строки 22–30)**

Удалить:
```js
// ── Field extractors ────────────────────────────────────────────────────────
const extractId = (field) => ...
const extractEmail = (field) => ...
```

- [ ] **Step 5: Обновить `normalizeCheckout` — инлайнить extractId/extractEmail**

```js
const normalizeCheckout = (raw) => ({
  id: raw.order?.id || raw.id,
  subscription_id: typeof raw.subscription === "object" && raw.subscription !== null ? raw.subscription.id : raw.subscription || null,
  customer_id: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.id : raw.customer || null,
  customer_email: typeof raw.customer === "object" && raw.customer !== null ? raw.customer.email : null,
  product_id: typeof raw.product === "object" && raw.product !== null ? raw.product.id : raw.product || null,
  amount: raw.order?.amount,
  currency: raw.order?.currency,
  current_period_start: null,
  current_period_end: null,
  cancel_at: null,
  status: raw.status,
  providerPayload: raw,
});
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/billing/providers/creem.js
git commit -m "refactor(billing): replace universal normalizeSubscription with per-event normalizers"
```

---

### Task 10: Финальная верификация

**Files:**
- Verify: `src/modules/billing/providers/creem.js`

- [ ] **Step 1: Проверить что сервер запускается без ошибок**

```bash
cd /Users/egorzozula/Desktop/BackendTemplate && node --env-file=.env -e "import('./src/modules/billing/providers/creem.js').then(() => console.log('OK')).catch(e => console.error(e))"
```

Expected: `OK`

- [ ] **Step 2: Очистить тестовые данные**

```bash
mongosh --quiet --eval 'db = db.getSiblingDB("myDatabase"); db.payments.deleteMany({}); db.orders.deleteMany({}); db.subscriptions.deleteMany({}); print("clean");'
```

- [ ] **Step 3: Запустить сервер и протестировать покупки**

```bash
cd /Users/egorzozula/Desktop/BackendTemplate && npm run dev
```

Сделать тестовые покупки:
1. Подписку → проверить: 1 payment + 1 subscription
2. One-off → проверить: 2 payments + 1 order + 1 subscription

```bash
mongosh --quiet --eval 'db = db.getSiblingDB("myDatabase"); print("payments:", db.payments.countDocuments()); print("orders:", db.orders.countDocuments()); print("subscriptions:", db.subscriptions.countDocuments());'
```

Expected: payments: 2, orders: 1, subscriptions: 1

- [ ] **Step 4: Финальный commit**

```bash
git add -A
git commit -m "verify(billing): creem normalizers refactor complete"
```
