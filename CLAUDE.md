# BackendTemplate — Claude Code Guide

## Stack

- **Runtime:** Node.js (ES modules, `"type": "module"`)
- **Framework:** Express 5
- **Database:** MongoDB + Mongoose
- **Auth:** JWT + OAuth 2.0 (cookie-based)
- **Billing:** creem.io (Merchant of Record) + creem SDK
- **Functional utils:** Ramda

## Project Structure

```
src/
├── app.js                        — Express entry point
├── db.js                         — MongoDB connection
│
├── modules/
│   ├── user/
│   │   ├── index.js              — public API (getUserById, getUser, createUser, updateUser, toUserDto, userRouter)
│   │   ├── model/User.js
│   │   ├── repository/userRepository.js
│   │   ├── services/userServices.js
│   │   ├── controller/userController.js
│   │   ├── routes/userRoutes.js
│   │   └── dto/userDto.js
│   │
│   ├── auth/
│   │   ├── index.js              — public API (authMiddleware, verifyAccessToken, authRouter)
│   │   ├── model/RefreshToken.js
│   │   ├── repository/refreshTokenRepository.js
│   │   ├── services/authServices.js
│   │   ├── controller/authController.js
│   │   ├── routes/authRoutes.js
│   │   ├── dto/authDto.js
│   │   ├── middleware/auth.js
│   │   ├── constants/auth.js
│   │   ├── utils/cookieOptions.js
│   │   └── providers/ (google.js, index.js)
│   │
│   └── billing/
│       ├── index.js              — public API (requireFeature, requirePlan, attachPlan, getUserBillingProfile, billingRouter)
│       ├── model/ (Subscription.js, Payment.js, Order.js)
│       ├── repository/ (subscriptionRepository.js, paymentRepository.js, orderRepository.js)
│       ├── services/ (billingServices.js, planServices.js)
│       ├── controller/billingController.js
│       ├── routes/billingRoutes.js
│       ├── dto/billingDto.js
│       ├── middleware/plan.js
│       ├── constants/billing.js
│       ├── hooks/productHooks.js
│       └── providers/ (creem.js, index.js)
│
├── models/Task.js                — example business model
├── repository/taskRepository.js  — example
├── services/taskServices.js      — example
├── controllers/taskController.js — example
├── middleware/taskMiddleware.js   — example
├── dto/taskDto.js                — example
├── constants/task.js             — example
├── providers/exampleProvider.js  — example
├── routes/
│   ├── routes.js                 — main router (mounts modules + business routes)
│   └── subroutes/taskRoutes.js   — example
│
└── shared/
    ├── utils/
    │   ├── fp.js                 — asyncPipe, pipe (Ramda)
    │   ├── duration.js           — parseDurationMs
    │   ├── http/ (httpResponse.js, httpError.js, httpStatus.js, httpUtils.js)
    │   └── validation/ (requestValidation.js, validators.js)
    └── constants/
        └── validation.js         — Regex patterns (RE_EMAIL, RE_PHONE)
```

## Module Isolation Rules

1. **Inter-module imports only through `index.js`** — `import { X } from '../user/index.js'` is allowed; `import { X } from '../user/repository/...'` is forbidden
2. **Intra-module imports are unrestricted** — files within the same module can import each other freely
3. **`shared/` is for genuinely shared code** — if a utility is used by only one module, it lives inside that module
4. **Root directories are for business logic** — `src/models/`, `src/services/`, etc. contain project-specific code, not module code
5. **`routes/routes.js` is the single entry point** — mounts both module routers and business routers

## Auth Module

### How it works

OAuth flow (Google as example):

```
GET /api/auth/google
  → createOauthState() → set state cookie → redirect to Google

GET /api/auth/google/callback?code=...&state=...
  → validate state (CSRF) → exchangeCode → getProfile
  → findOrCreateUser → createSession
  → set accessToken + refreshToken cookies → redirect to FRONTEND_URL

POST /api/auth/refresh
  → read refreshToken cookie → validate in DB → createAccessToken
  → set new accessToken cookie → return { accessToken }

POST /api/auth/logout
  → delete refreshToken from DB → clear cookies → 200
```

### File responsibilities

| File | Responsibility |
|------|----------------|
| `src/modules/auth/providers/google.js` | HTTP calls to Google API — buildAuthUrl, exchangeCode, getProfile |
| `src/modules/auth/providers/index.js` | Provider registry — `PROVIDERS = { google }` |
| `src/modules/auth/model/RefreshToken.js` | Mongoose schema — token, userId, provider, providerUserId, expiresAt |
| `src/modules/auth/repository/refreshTokenRepository.js` | DB access for RefreshToken |
| `src/modules/auth/services/authServices.js` | JWT creation/verification, OAuth state, findOrCreateUser, createSession |
| `src/modules/auth/controller/authController.js` | HTTP handlers — login, callback, refresh, logout |
| `src/modules/auth/routes/authRoutes.js` | Route definitions for /auth/* |
| `src/modules/auth/middleware/auth.js` | JWT verification — reads from Bearer header OR accessToken cookie |
| `src/modules/auth/utils/cookieOptions.js` | Cookie options + parseDurationMs |

### Provider contract

Every provider must export an object with these 3 functions:

```js
{
  buildProviderAuthUrl(state)   → String   // redirect URL for the user
  exchangeProviderCode(code)    → Object   // raw token response from provider
  getProviderProfile(tokens)    → {        // normalized profile — always this shape
    providerUserId: String,
    email: String,
    name: String,
    avatar: String,
  }
}
```

### How to add a new provider

Используй скилл `/add-auth-provider` — он проведёт по всем шагам.

## Billing Module

### How it works

Billing is powered by creem.io (Merchant of Record). Creem handles recurring payments, taxes, and compliance. We react to webhooks.

```
Frontend creates checkout → user pays on creem.io hosted page

POST /api/billing/webhook (creem sends webhooks)
  → verify HMAC signature → route by event_type
  → checkout.completed (subscription product): find user → create Payment + Subscription → run onActivate hook
  → checkout.completed (one-time product): find user → create Payment + Order
  → subscription.paid: update Subscription status → create Payment → run onRenew hook
  → subscription.canceled/expired: update status → run onDeactivate hook
```

### Architecture: State Machine + Product Hooks

Two layers:
1. **State machine** — generic webhook processing, updates Subscription status in DB
2. **Product hooks** — per-plan business logic in `src/modules/billing/hooks/productHooks.js`

### File responsibilities

| File | Responsibility |
|------|----------------|
| `src/modules/billing/constants/billing.js` | SUBSCRIPTION_PRODUCTS, ONE_TIME_PRODUCTS, PRODUCTS, PLANS, PLAN_HIERARCHY, WEBHOOK_EVENT, statuses, WEBHOOK_STATUS_MAP |
| `src/modules/billing/model/Subscription.js` | Current subscription state (mutable, one per user) |
| `src/modules/billing/model/Payment.js` | Payment history (append-only, idempotent via providerEventId) |
| `src/modules/billing/model/Order.js` | One-time product purchases (idempotent via providerOrderId) |
| `src/modules/billing/repository/subscriptionRepository.js` | DB operations for Subscription |
| `src/modules/billing/repository/paymentRepository.js` | DB operations for Payment |
| `src/modules/billing/repository/orderRepository.js` | DB operations for Order |
| `src/modules/billing/providers/creem.js` | creem SDK wrapper + HMAC signature verification |
| `src/modules/billing/providers/index.js` | Billing provider registry |
| `src/modules/billing/services/billingServices.js` | Webhook event processing, checkout routing (subscription vs order) |
| `src/modules/billing/services/planServices.js` | getUserBillingProfile — merges plan + product features/limits |
| `src/modules/billing/hooks/productHooks.js` | Product lifecycle hooks (onActivate, onDeactivate, onRenew) |
| `src/modules/billing/controller/billingController.js` | Webhook, plan, subscription, payments, orders handlers |
| `src/modules/billing/routes/billingRoutes.js` | POST /billing/webhook, GET /plan, /subscription, /payments, /orders, POST /cancel |
| `src/modules/billing/middleware/plan.js` | requireFeature(), requirePlan(), attachPlan() |
| `src/modules/billing/dto/billingDto.js` | Subscription/Payment/Order DTO transforms |

### How to add a new product

Используй скилл `/add-billing-product` — он проведёт по всем шагам.

### Plan middleware usage

```js
import { requireFeature, requirePlan, attachPlan } from "../modules/billing/index.js";

router.get("/export", authMiddleware, requireFeature("export"), handleExport);
router.get("/dashboard", authMiddleware, attachPlan, handleDashboard);
// req.plan = { key: "pro", features: {...}, limits: {...}, products: ["export_pack"] }
```

## HTTP Utilities

```js
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";

// Send response
httpResponse(res, generalStatus.SUCCESS, data)
httpResponse(res, generalStatus.UNAUTHORIZED)

// Send error
httpResponseError(res, error)  // handles HttpError, DomainError, or generic

// Status codes
generalStatus.SUCCESS       // 200
generalStatus.BAD_REQUEST   // 400
generalStatus.UNAUTHORIZED  // 401
generalStatus.NOT_FOUND     // 404
generalStatus.ERROR         // 500
```

## Timezone Contract

### Storage
- All `Date` fields in MongoDB are **UTC**
- Timezone strings: IANA identifiers (`"Europe/Kyiv"`, `"America/New_York"`)

### Timezone Priority
1. **Org schedule** → `Organization.timezone` (single source, `ScheduleTemplate.timezone` is `null`)
2. **Personal schedule** → `ScheduleTemplate.timezone`
3. **Fallback** → `"UTC"` (never hardcode a specific city)

`ScheduleTemplate.timezone` exists ONLY for personal schedules (`orgId === null`).
For org schedules, the field is absent — timezone is resolved from `Organization`.

### Resolver
All services use `resolveScheduleTimezone(template, getOrgTimezone)` from `src/shared/utils/timezone.js`.
Never read `template.timezone` directly — always go through the resolver.

### Parsing Input
- Frontend sends `startAt` as naive wall-clock: `"2026-04-15T14:00:00"` (no `Z`, no offset)
- Backend resolves timezone via `resolveScheduleTimezone()` and calls `parseWallClockToUtc(startAt, resolvedTimezone)`
- `parseWallClockToUtc` uses double-conversion to handle DST transitions safely

### Notification Timezone Resolution
- Telegram/email: resolve timezone via fallback chain `template.timezone → org.timezone → "UTC"`
- Never hardcode `"Europe/Kyiv"` or any specific city as fallback

### Override Dates
- Override `date` field stored as `Date` at UTC midnight (`2026-04-15T00:00:00.000Z`)
- Frontend must send date-only string `"YYYY-MM-DD"`; server normalizes to UTC midnight

### Forbidden Patterns
```js
// WRONG: hardcoded city fallback
const tz = template?.timezone ?? "Europe/Kyiv"

// CORRECT: fallback chain
const tz = template?.timezone ?? org?.timezone ?? "UTC"
```

## Code Rules

- `const` only, no `let`
- Named functions — no inline lambdas in map/filter/reduce
- Pure functions separated from side effects
- Guard clauses at caller level (not inside functions)
- Config objects instead of if/switch
- Ramda for composition (`R.pipe`, `R.curry`)
- Fetch Context7 docs before using any external library
