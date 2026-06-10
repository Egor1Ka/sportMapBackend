// ── Хелперы ─────────────────────────────────────────────────────────────────
// Creem может прислать product/customer/subscription как объект или строку (ID).
// Контракт из Creem SDK: product: ProductEntity | string, customer: CustomerEntity | string

// Извлекает ID из поля, которое может быть объектом ({ id: "..." }) или строкой ("...").
const extractId = (field) => field?.id ?? field ?? null;

// ── checkout.completed ──────────────────────────────────────────────────────
// Создаёт Payment + Order (one-time) или Payment + Subscription (recurring).
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
// Создаёт Payment запись при продлении подписки.
// ID = order ID из транзакции (дедуплицирует с checkout.completed для начального платежа).
// Фолбэки: transaction ID → subscription ID (если Creem не пришлёт order).
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

// ── Статусные события подписки ───────────────────────────────────────────────
// Общая база для событий, которые меняют статус подписки без платёжных данных.
// active, canceled, expired, paused, past_due, scheduled_cancel
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

// canceled и scheduled_cancel — добавляют дату отмены
const normalizeSubscriptionCanceled        = (raw) => ({ ...baseSubscriptionFields(raw), cancel_at: raw.canceled_at });
const normalizeSubscriptionScheduledCancel = (raw) => ({ ...baseSubscriptionFields(raw), cancel_at: raw.canceled_at });

// ── refund.created / dispute.created ─────────────────────────────────────────
// Общая база для событий с суммой, но без периодов подписки (refund, dispute).
const normalizeSimpleEvent = (raw) => ({
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

const normalizeRefund  = normalizeSimpleEvent;
const normalizeDispute = normalizeSimpleEvent;

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
