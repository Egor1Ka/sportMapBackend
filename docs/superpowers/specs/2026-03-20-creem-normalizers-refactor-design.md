# Рефакторинг: отдельные normalizer'ы для каждого Creem события

**Дата:** 2026-03-20
**Файл:** `src/modules/billing/providers/creem.js`

## Проблема

Один универсальный `normalizeSubscription` обслуживает все события подписки. Формирование `id` — магическая цепочка фолбэков:

```js
id: raw.last_transaction?.order || raw.last_transaction_id || raw.last_transaction?.id || raw.id
```

Непонятно какое поле используется для какого события. Разные события имеют разные payload'ы и разные требования к ID.

## Решение

Заменить `normalizeSubscription` на отдельные самостоятельные normalizer'ы для каждого `eventType`. Каждая функция — полностью независимая, без общих хелперов. Маппинг `eventType → normalizer` через конфиг-объект.

## Normalizer'ы

### 1. normalizeCheckout — `checkout.completed`

Уже существует. Без изменений.

- **ID:** `raw.order.id` (order ID)
- **Платёжные данные:** amount, currency из order
- **Используется для:** создания Payment + Order (one-time) или Payment + Subscription (recurring)

### 2. normalizeSubscriptionPayment — `subscription.paid`

- **ID:** `raw.last_transaction.order` → фолбэк `raw.last_transaction_id` → фолбэк `raw.id` (order ID приоритетнее — совпадает с checkout для дедупликации начального платежа, уникален для renewals. Фолбэки на случай если Creem не пришлёт order в транзакции)
- **Платёжные данные:** amount, currency из last_transaction
- **Период:** current_period_start/end
- **Используется для:** создания Payment записи при продлении подписки

### 3. normalizeSubscriptionActive — `subscription.active`

- **ID:** `raw.id` (subscription ID)
- **Платёжных данных нет** (amount/currency = null)
- **Период:** current_period_start/end
- **Используется для:** обновления статуса подписки на "active"

### 4. normalizeSubscriptionCanceled — `subscription.canceled`

- **ID:** `raw.id` (subscription ID)
- **Платёжных данных нет**
- **cancel_at:** `raw.canceled_at`
- **Используется для:** обновления статуса подписки на "canceled"

### 5. normalizeSubscriptionExpired — `subscription.expired`

- **ID:** `raw.id` (subscription ID)
- **Платёжных данных нет**
- **Период:** current_period_start/end
- **Используется для:** обновления статуса на "expired", запуска хука onDeactivate

### 6. normalizeSubscriptionPaused — `subscription.paused`

- **ID:** `raw.id` (subscription ID)
- **Платёжных данных нет**
- **Период:** current_period_start/end
- **Используется для:** обновления статуса на "paused"

### 7. normalizeSubscriptionPastDue — `subscription.past_due`

- **ID:** `raw.id` (subscription ID)
- **Платёжных данных нет**
- **Период:** current_period_start/end
- **Используется для:** обновления статуса на "past_due"

### 8. normalizeSubscriptionScheduledCancel — `subscription.scheduled_cancel`

- **ID:** `raw.id` (subscription ID)
- **Платёжных данных нет**
- **cancel_at:** `raw.canceled_at`
- **Период:** current_period_start/end
- **Используется для:** обновления статуса на "scheduled_cancel"

### 9. normalizeRefund — `refund.created`

- **ID:** `raw.id`
- **Платёжные данные:** amount, currency из raw
- **Используется для:** создания Payment записи типа refund

### 10. normalizeDispute — `dispute.created`

- **ID:** `raw.id`
- **Платёжные данные:** amount, currency из raw
- **Используется для:** создания Payment записи типа dispute

## Маппинг событий

```js
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

`parseWebhookEvent` ищет normalizer в `EVENT_NORMALIZERS[eventType]`. Если не найден — логирует предупреждение и возвращает `null`.

## Выходной формат

Все normalizer'ы возвращают одинаковую shape для совместимости с `billingServices.js`:

```js
{
  id,                    // уникальный ID для providerEventId в Payment
  subscription_id,       // ID подписки (null для one-off/refund/dispute)
  customer_id,           // ID клиента в Creem
  customer_email,        // email клиента
  product_id,            // ID продукта в Creem
  amount,                // сумма (null для статусных событий)
  currency,              // валюта (null для статусных событий)
  current_period_start,  // начало периода (null где неприменимо)
  current_period_end,    // конец периода (null где неприменимо)
  cancel_at,             // дата отмены (null где неприменимо)
  status,                // статус из payload
  providerPayload,       // оригинальный payload целиком
}
```

## Что меняется

| Компонент | До | После |
|---|---|---|
| `creem.js` normalizer'ы | `normalizeCheckout` + `normalizeSubscription` (2 функции) | 10 самостоятельных функций |
| `creem.js` маппинг | `if checkout → normalizeCheckout, else → normalizeSubscription` | `EVENT_NORMALIZERS[eventType]` |
| `creem.js` extractId/extractEmail | Общие хелперы | Инлайн в каждом normalizer'е |
| `billingServices.js` | Без изменений | Без изменений |
| `billingController.js` | Без изменений | Без изменений |

## Что НЕ меняется

- Формат выходных данных (shape объекта) — полная обратная совместимость
- `billingServices.js` — потребители данных не затрагиваются
- Модели, репозитории, контроллер — без изменений
- Бизнес-логика обработки событий — без изменений
