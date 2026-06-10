# Frontend: Separate Subscriptions and Products in Billing UI

## Problem

The billing "Plan" tab shows all products (subscriptions and one-time purchases) in the same 3-column grid with identical card styling. Users can't tell which are recurring subscriptions and which are one-time purchases. Starter is displayed as a subscription plan but has no subscription product — it should be a one-time product.

## Behavioral Change

Starter is reclassified from a subscription plan to a one-time product. After this change:
- Subscription plans: Free, Pro
- One-time products: Starter Pack (key: `export_pack`)

**Existing `starter` users:** There are no existing users with `planKey: 'starter'` in production — this is a template project. The `starter` plan can be safely removed from backend constants.

## Design

### Tab "Plan" — Three Visual Sections

```
┌─────────────────────────────────────────────────┐
│ Current Plan    Pro   Active                    │
│ Projects: ∞    Storage: 50000 MB                │
│ Products: Starter Pack                          │
│ [Cancel subscription]                           │
└─────────────────────────────────────────────────┘

── Subscription Plans ────────────────────────────

┌──────────────┐  ┌──────────────────┐
│ Free         │  │ Pro      Current │
│ $0 /month    │  │ $29 /month       │
│ ✓ 3 projects │  │ ✓ Unlimited      │
│ ✓ Dashboard  │  │ ✓ Dashboard      │
│ ✓ Community  │  │ ✓ Export         │
│              │  │ ✓ API access     │
│              │  │ ✓ Priority       │
└──────────────┘  └──────────────────┘

── Products ──────────────────────────────────────

┌──────────────────────────┐
│ Starter Pack         $9  │
│ One-time purchase        │
│ ✓ Export data            │
│ ✓ 5000 MB storage       │
│ [Buy]                    │
└──────────────────────────┘
```

### Current Plan Card

Add a "Products:" line showing purchased product names. Data: `plan.products` mapped through `PRODUCT_DETAILS` for display names.

- If no products purchased — "Products:" line is hidden
- "Products:" line is outside the subscription-gated block (shows even on free plan with no subscription)
- "Cancel subscription" button only shown when subscription exists (unchanged)

### Subscription Plans Section

Only Free and Pro. Grid: `lg:grid-cols-2`.

```js
const PLAN_HIERARCHY = ['free', 'pro']

const PLAN_DETAILS = {
  free: { name: 'Free', price: '$0', period: '/month', features: [...], productId: null },
  pro:  { name: 'Pro',  price: '$29', period: '/month', features: [...], productId: 'prod_TkVdhx4EhreepQ0TwmrrL' },
}
```

### Products Section

One-time products with Buy button via `CreemCheckout` (same `checkoutPath="/api/checkout"` as subscriptions — Creem handles both types identically).

```js
const PRODUCT_DETAILS = {
  export_pack: {
    name: 'Starter Pack',
    price: '$9',
    features: ['Export data', '5000 MB storage'],
    productId: 'prod_4tHvpNEWtUFrf8LaGBqyh8',
  },
}
```

**Display name source of truth:** `PRODUCT_DETAILS` on the frontend. Backend `PRODUCTS.export_pack.name` stays "Export Pack" (internal name, not user-facing).

**Purchased filtering:** If product key exists in `plan.products` — don't show the card in Products section.

**Empty state:** If all products are purchased, the "Products" section heading and cards are hidden entirely.

### Edge Cases

- **No subscription + no products:** Current Plan shows "Free", no "Products:" line, no cancel button
- **No subscription + purchased product:** Current Plan shows "Free" + "Products: Starter Pack", no cancel button
- **All products purchased:** Products section hidden
- **Unknown plan key fallback:** If `plan.key` is not in `PLAN_DETAILS`, treat as free (no card highlighted)

## Modified Files

### Backend

| File | Change |
|------|--------|
| `src/modules/billing/constants/billing.js` | Remove `starter` from `PLAN_HIERARCHY` and `PLANS` |
| `src/modules/billing/hooks/productHooks.js` | Remove `starter` hook entry (dead code) |

### Frontend

| File | Change |
|------|--------|
| `components/billing-plan-tab.tsx` | Remove Starter from `PLAN_DETAILS`/`PLAN_HIERARCHY`. Add `PRODUCT_DETAILS`. Add Products section. Add purchased products in Current Plan card. Grid `lg:grid-cols-2` for plans |
| `services/configs/billing.config.ts` | Update `Plan.key` type: `'free' \| 'pro'` (remove `'starter'`) |
| `services/index.ts` | No change needed (re-exports Plan type) |
| `app/[locale]/(app)/billing/page.tsx` | Update loading skeleton: 2 columns for plans + product skeleton. Pass `plan` to BillingPlanTab (unchanged interface) |
| `app/[locale]/(landing)/page.tsx` | Update `planKeys` to `['free', 'pro']`, remove Starter pricing card |
| `i18n/messages/en.json` | Remove `starter` plan translations, add `export_pack` product translations if needed |
| `i18n/messages/uk.json` | Same as en.json |

## Data Flow

```
GET /api/billing/plan → { key: "pro", features: {...}, limits: {...}, products: ["export_pack"] }

BillingPlanTab receives plan prop:
  → plan.key + PLAN_DETAILS           → highlight current subscription card
  → plan.products + PRODUCT_DETAILS   → show "Products: Starter Pack" in Current Plan
  → PRODUCT_DETAILS minus purchased   → render buyable product cards
```

## What Does NOT Change

- BillingHistoryTab (payment history)
- API endpoints
- Data fetching logic in billing page (same Promise.all)
- CreemCheckout integration pattern
- BillingPlanTab props interface
- Backend Order model, repository, services
- Toast on `checkout=success` (works generically for both types)
