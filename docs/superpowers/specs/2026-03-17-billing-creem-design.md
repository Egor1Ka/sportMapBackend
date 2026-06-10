# Billing Module — creem.io Integration

## Context

BackendTemplate — эталонный шаблон бэкенда с чистой слоёной архитектурой (Models → Repository → Services → Controllers → Routes). Нужно добавить модуль биллинга на основе creem.io (Merchant of Record), который будет обрабатывать вебхуки оплат, управлять подписками и one-time покупками, и предоставлять config-driven систему фич и лимитов по планам.

**Зачем:** дать шаблону готовую, расширяемую архитектуру биллинга, где добавление нового продукта — это добавление строки в конфиг + хуков бизнес-логики.

## Решения

- **SDK:** `creem` npm пакет (полный SDK, верификация вебхуков через HMAC-SHA256 вручную; `creem_io` deprecated)
- **Подход:** State Machine + Product Hooks — разделение на generic state transitions и product-specific бизнес-логику
- **Хранение:** локально в MongoDB (Subscription + Payment коллекции)
- **API:** только вебхуки (checkout создаётся на фронте напрямую с creem)
- **Конфиг фич:** в коде (config object), не в базе
- **Связка юзеров:** по email при checkout.completed

## Структура файлов

```
src/
├── constants/
│   └── billing.js                    — PLANS, PRODUCT_PLANS, PLAN_HIERARCHY, статусы
├── models/
│   ├── Subscription.js               — Текущее состояние подписки (мутабельное, одна запись на юзера)
│   └── Payment.js                    — История платежей (append-only лог)
├── repository/
│   ├── subscriptionRepository.js     — CRUD для Subscription
│   └── paymentRepository.js          — Создание и выборка Payment
├── services/
│   ├── billingServices.js            — Обработка вебхуков, state transitions, оркестрация
│   └── planServices.js               — Pure-функции резолвинга планов + side-effectful обёртки
├── controllers/
│   └── billingController.js          — POST /billing/webhook хэндлер
├── routes/subroutes/
│   └── billingRoutes.js              — Маршрут для вебхука
├── providers/
│   └── billing/
│       ├── creem.js                  — Обёртка над creem_io SDK (изолирует зависимость)
│       └── index.js                  — Provider registry (аналог providers/auth/index.js)
├── dto/
│   └── billingDto.js                 — Трансформация Subscription/Payment → response shape
├── services/
│   └── billing/
│       └── hooks.js                  — Product lifecycle hooks (onActivate, onDeactivate, onRenew)
└── middleware/
    └── plan.js                       — requireFeature(), requirePlan(), attachPlan()
```

## MongoDB модели

### Subscription

Одна мутабельная запись на юзера. Обновляется при каждом вебхуке подписки.

```
{
  userId:              ObjectId → User (required, indexed)
  creemSubscriptionId: String (required, unique)
  creemCustomerId:     String (required)
  productId:           String (required)
  planKey:             String (required)                    // "starter", "pro" — из PRODUCT_PLANS
  status:              String (enum: active|past_due|canceled|expired|paused|scheduled_cancel)
  currentPeriodStart:  Date
  currentPeriodEnd:    Date
  cancelAt:            Date                                 // для scheduled_cancel
  timestamps:          true
}

Indexes:
  { userId: 1, status: 1 }           — быстрый поиск активной подписки юзера
  { creemSubscriptionId: 1 }         — unique, для обновления по вебхуку
```

### Payment

Append-only лог финансовых событий. Каждый вебхук с деньгами создаёт запись.

```
{
  userId:              ObjectId → User (indexed, nullable — если юзер не найден)
  creemSubscriptionId: String (nullable — null для one-time)
  creemEventId:        String (required, unique)            // ID события из creem для идемпотентности
  productId:           String (required)
  type:                String (enum: subscription|one_time)
  eventType:           String (required)                    // raw creem event: "checkout.completed", "subscription.paid"
  amount:              Number
  currency:            String
  creemPayload:        Mixed                                // raw данные из вебхука для дебага
  timestamps:          true
}

Indexes:
  { userId: 1, type: 1 }             — для запроса one-time покупок
  { creemEventId: 1 }                — unique, предотвращает дубликаты вебхуков
```

**Почему две коллекции:**
- Subscription — быстрый ответ на "есть ли доступ" (один документ, индексированный)
- Payment — полная история для UI и аудита (append-only)
- One-time покупки создают Payment с `type: "one_time"`, без Subscription

**Идемпотентность:** `creemEventId` с unique индексом — при повторном вебхуке `createPayment` выбросит duplicate key error, который ловим и игнорируем (событие уже обработано).

## Constants — конфиг планов

`src/constants/billing.js` — единственный файл для настройки продуктов:

```js
// Маппинг creem product ID → внутренний план
const PRODUCT_PLANS = {
  "prod_starter_monthly": "starter",
  "prod_starter_yearly":  "starter",
  "prod_pro_monthly":     "pro",
  "prod_pro_yearly":      "pro",
  "prod_lifetime":        "pro",                  // one-time purchase → тот же план
};

// Иерархия планов (от слабого к сильному) — для выбора лучшего плана
const PLAN_HIERARCHY = ["free", "starter", "pro"];

// Фичи и лимиты
const PLANS = {
  free: {
    features: { dashboard: true, export: false, apiAccess: false },
    limits:   { projects: 3, storage: 100 },
  },
  starter: {
    features: { dashboard: true, export: true, apiAccess: false },
    limits:   { projects: 20, storage: 5000 },
  },
  pro: {
    features: { dashboard: true, export: true, apiAccess: true },
    limits:   { projects: Infinity, storage: 50000 },
  },
};

// Статусы подписок
const SUBSCRIPTION_STATUS = {
  ACTIVE:           "active",
  PAST_DUE:         "past_due",
  CANCELED:         "canceled",
  EXPIRED:          "expired",
  PAUSED:           "paused",
  SCHEDULED_CANCEL: "scheduled_cancel",
};

// Статусы, которые дают доступ к фичам
const ACCESS_GRANTING_STATUSES = [
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.PAST_DUE,
  SUBSCRIPTION_STATUS.SCHEDULED_CANCEL,
];
```

**Добавить новый продукт:** строка в `PRODUCT_PLANS` + план в `PLANS` + позиция в `PLAN_HIERARCHY`.

## Provider — creem SDK обёртка

`src/providers/billing/creem.js` — изолирует зависимость от `creem_io`:

```js
import { createCreem } from "creem_io";

const creem = createCreem({
  apiKey: process.env.CREEM_API_KEY,
  testMode: process.env.CREEM_TEST_MODE === "true",
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET,
});

const handleWebhookEvents = (body, signature, handlers) =>
  creem.webhooks.handleEvents(body, signature, handlers);

export default { handleWebhookEvents };
```

`src/providers/billing/index.js` — реестр провайдеров (аналог `src/providers/auth/index.js`):

```js
import creem from "./creem.js";
const BILLING_PROVIDERS = { creem };
const getBillingProvider = (name) => BILLING_PROVIDERS[name];
export { getBillingProvider };
export default BILLING_PROVIDERS;
```

## Repository слой

### subscriptionRepository

```
upsertByCreemSubscriptionId(creemSubscriptionId, data)   → Subscription
getActiveSubscriptionByUserId(userId)                     → Subscription | null
getSubscriptionByCreemId(creemSubscriptionId)             → Subscription | null
updateStatusByCreemId(creemSubscriptionId, updateFields)  → { before, after } | null
```

### paymentRepository

```
createPayment(data)                    → Payment
getPaymentsByUserId(userId)            → [Payment]
hasOneTimePurchase(userId, productId)  → Boolean
getOneTimePurchasesByUserId(userId)    → [Payment]
```

## Services слой

### billingServices.js — обработка вебхуков (side effects)

Config-driven маппинг вебхук-события → статус:

```js
const WEBHOOK_STATUS_MAP = {
  "subscription.active":           "active",
  "subscription.paid":             "active",
  "subscription.past_due":         "past_due",
  "subscription.canceled":         "canceled",
  "subscription.expired":          "expired",
  "subscription.paused":           "paused",
  "subscription.scheduled_cancel": "scheduled_cancel",
};
```

Ключевые функции:

- **processCheckoutCompleted(data)** — находит юзера по email, определяет subscription vs one-time, создаёт Payment (с проверкой идемпотентности через creemEventId), создаёт/обновляет Subscription, запускает хук `onActivate`
- **processSubscriptionEvent(eventType, data)** — обновляет статус через `WEBHOOK_STATUS_MAP`, создаёт Payment для `subscription.paid`, запускает хуки при переходах:
  - active→canceled/expired = `onDeactivate`
  - any→active (когда `subscription.paid` и подписка уже была active) = `onRenew`
  - any→active (когда подписка не была active) = `onActivate`
- **processRefund(data)** — создаёт Payment запись
- **processDispute(data)** — создаёт Payment запись

### planServices.js — резолвинг планов

**Pure функции** (без side effects):

- **resolvePlanKey(productId)** → `PRODUCT_PLANS[productId]` или `"free"`
- **resolveBestPlan(subscription, oneTimePurchases)** → берёт planKey из подписки и one-time покупок, возвращает лучший план по `PLAN_HIERARCHY`
- **getPlanConfig(planKey)** → `PLANS[planKey]`
- **planHasFeature(plan, featureName)** → `plan.features[featureName]`
- **getPlanLimit(plan, limitName)** → `plan.limits[limitName]`

**Оркестраторы** (side effects — обращение к БД):

- **getUserPlan(userId)** → запрашивает активную подписку + one-time покупки из репозиториев, вызывает `resolveBestPlan`, возвращает `{ key, features, limits }`
- **userHasFeature(userId, featureName)** → `getUserPlan` → `planHasFeature`
- **getUserLimit(userId, limitName)** → `getUserPlan` → `getPlanLimit`

## Product Hooks

`src/services/billing/hooks.js` — бизнес-логика по продуктам (внутри services слоя):

```js
const PRODUCT_HOOKS = {
  starter: {
    onActivate:   async (user, subscription) => { /* provision */ },
    onDeactivate: async (user, subscription) => { /* restrict */ },
    onRenew:      async (user, subscription) => { /* renewal logic */ },
  },
  pro: {
    onActivate:   async (user, subscription) => { /* provision pro */ },
    onDeactivate: async (user, subscription) => { /* cleanup pro */ },
    onRenew:      async (user, subscription) => { /* renewal logic */ },
  },
};
```

Вызов хука — ответственность вызывающего кода (caller):

```js
// В billingServices — перед вызовом проверяем наличие хука
const hooks = getHooksForPlan(planKey);
if (hooks && hooks.onActivate) {
  await hooks.onActivate(user, subscription);
}
```

**Когда вызывается onRenew:** при `subscription.paid`, когда подписка уже в статусе `active` (т.е. продление, а не первая активация).

## Controller

`src/controllers/billingController.js`:

```js
const buildStatusHandler = (eventType) => (data) =>
  billingServices.processSubscriptionEvent(eventType, data);

const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["creem-signature"];
    if (!signature) return httpResponse(res, generalStatus.BAD_REQUEST);

    await creemProvider.handleWebhookEvents(req.body, signature, {
      onCheckoutCompleted: billingServices.processCheckoutCompleted,
      onSubscriptionActive: buildStatusHandler("subscription.active"),
      onSubscriptionPaid: buildStatusHandler("subscription.paid"),
      onSubscriptionPastDue: buildStatusHandler("subscription.past_due"),
      onSubscriptionCanceled: buildStatusHandler("subscription.canceled"),
      onSubscriptionExpired: buildStatusHandler("subscription.expired"),
      onSubscriptionScheduledCancel: buildStatusHandler("subscription.scheduled_cancel"),
      onSubscriptionPaused: buildStatusHandler("subscription.paused"),
      onRefundCreated: billingServices.processRefund,
      onDisputeCreated: billingServices.processDispute,
    });

    httpResponse(res, generalStatus.SUCCESS);
  } catch (error) {
    httpResponseError(res, error);
  }
};
```

## Routes

`POST /billing/webhook` — без auth middleware (верификация через HMAC подпись SDK).

Монтируется в `src/routes/routes.js`:
```js
router.use("/billing", billingRoutes);
```

## Raw body для HMAC верификации

**Решение:** монтировать вебхук-роут с `express.raw()` ДО глобального `express.json()` в `src/app.js`:

```js
// В app.js — ДО express.json()
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

// Потом глобальный JSON parser
app.use(express.json({ limit: "10mb" }));
```

Это гарантирует, что на вебхук-роут приходит raw Buffer, а все остальные роуты получают parsed JSON.

## DTO

`src/dto/billingDto.js`:

```js
// Subscription → response shape
const subscriptionToDTO = (doc) => ({
  id: doc._id.toString(),
  planKey: doc.planKey,
  status: doc.status,
  productId: doc.productId,
  currentPeriodEnd: doc.currentPeriodEnd,
  cancelAt: doc.cancelAt,
  createdAt: doc.createdAt,
});

// Payment → response shape
const paymentToDTO = (doc) => ({
  id: doc._id.toString(),
  type: doc.type,
  eventType: doc.eventType,
  amount: doc.amount,
  currency: doc.currency,
  createdAt: doc.createdAt,
});
```

## Middleware

`src/middleware/plan.js`:

```js
// Curried фабрика — config-driven
const requireFeature = (featureName) => async (req, res, next) => {
  const hasAccess = await planServices.userHasFeature(req.user.id, featureName);
  if (!hasAccess) return httpResponse(res, billingStatus.FEATURE_LOCKED);
  next();
};

const requirePlan = (minimumPlanKey) => async (req, res, next) => {
  const userPlan = await planServices.getUserPlan(req.user.id);
  const userLevel = PLAN_HIERARCHY.indexOf(userPlan.key);
  const requiredLevel = PLAN_HIERARCHY.indexOf(minimumPlanKey);
  if (userLevel < requiredLevel) return httpResponse(res, billingStatus.PLAN_REQUIRED);
  next();
};

// attachPlan — добавляет план в req для использования в хэндлере
// Shape: { key: "pro", features: {...}, limits: {...} }
const attachPlan = async (req, res, next) => {
  req.plan = await planServices.getUserPlan(req.user.id);
  next();
};
```

Использование:
```js
router.get("/export", authMiddleware, requireFeature("export"), handleExport);
router.get("/dashboard", authMiddleware, attachPlan, handleDashboard);
```

## Связка Creem → User

При `checkout.completed` — матчим по `data.customer.email` → `userRepository.getUser({ email })`.

Email unique в модели User. `creemCustomerId` хранится в Subscription как связующий ключ.

Если юзер не найден (удалён между чекаутом и вебхуком) — Payment создаётся с `userId: null`, данные не теряются.

## HTTP статусы

Добавить в `src/utils/http/httpStatus.js` (named export, как `generalStatus` и `userStatus`):
```js
export const billingStatus = {
  FEATURE_LOCKED: { status: 403, message: "featureLocked" },
  PLAN_REQUIRED:  { status: 403, message: "planRequired" },
};
```

## Переменные окружения

Добавить в `.env` и `.env.example`:
```
CREEM_API_KEY=creem_...
CREEM_WEBHOOK_SECRET=whsec_...
CREEM_TEST_MODE=true
```

## Важные детали реализации

1. **Raw body для HMAC:** решение — `express.raw()` на вебхук-роуте ДО глобального `express.json()` (см. секцию выше).

2. **Race conditions:** creem может отправить `checkout.completed` и `subscription.active` почти одновременно. Паттерн `upsert` по `creemSubscriptionId` решает это — оба пишут в один документ.

3. **Идемпотентность:** `creemEventId` с unique индексом в Payment. При дубликате вебхука ловим MongoDB duplicate key error и возвращаем 200 (событие уже обработано).

4. **One-time + subscription:** `resolveBestPlan` проверяет и подписку, и one-time покупки. Берёт план с наивысшей позицией в `PLAN_HIERARCHY`.

5. **onRenew vs onActivate:** `subscription.paid` при уже active подписке → `onRenew`. При переходе из другого статуса в active → `onActivate`.

## Verification

1. Установить `creem_io`, создать все файлы модуля
2. Отправить тестовый вебхук (creem sandbox) на `/api/billing/webhook`
3. Проверить: Payment создан в базе, Subscription создана/обновлена, хуки вызваны
4. Отправить повторный вебхук — проверить идемпотентность (Payment не дублируется)
5. Проверить middleware `requireFeature` на защищённом роуте
6. Проверить edge cases: юзер не найден по email, one-time покупка, plan hierarchy resolution
7. Обновить CLAUDE.md — добавить секцию Billing Module
