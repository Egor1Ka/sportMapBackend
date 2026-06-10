# Modular Isolation — BackendTemplate

**Date:** 2026-03-18
**Status:** Approved

## Problem

BackendTemplate contains base modules (auth, user, billing) that will be reused across multiple projects. Currently all layers (models, services, controllers, etc.) are flat at `src/` level with no module boundaries. This makes it hard to:

- Understand which files belong to which module
- Control what one module exposes to others
- Extract a module into a separate package in the future
- Distinguish base infrastructure from project-specific business logic

## Goals

1. Isolate base modules (auth, user, billing) into `src/modules/` with clear boundaries
2. Keep root-level directories (`src/models/`, `src/services/`, etc.) for project-specific business logic
3. Provide working Task examples in root directories as templates for new developers
4. Prepare modules for future extraction into npm packages with minimal refactoring
5. No runtime behavior changes — pure structural refactor

## Non-Goals

- Moving to npm packages, monorepo, or git submodules (future decision)
- Dependency injection or event-driven architecture
- Adding TypeScript
- Changing existing business logic or API contracts

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module isolation | Same repo, better boundaries | No overhead of separate packages, ready for future extraction |
| Inter-module imports | Only through `index.js` | Controlled public API, internal refactoring won't break consumers |
| Module communication | Direct imports (not DI, not events) | Simple, no TypeScript to enforce DI contracts |
| Middleware location | Inside owning module | Auth middleware belongs to auth, plan middleware belongs to billing |
| Private constants/utils | Inside owning module | If used by one module — lives inside it |
| Shared code | `src/shared/` | Only genuinely shared utilities (http, fp, validation) |
| Root directories | Kept for business logic with Task examples | Future developers see where to write project-specific code |
| Route mounting | `routes/routes.js` mounts module routers + business routers | Single entry point, clear separation |
| Example entity | Task (title, description, status, userId) | Simple CRUD, demonstrates all layers |

## Target Structure

```
src/
├── app.js
├── db.js
│
├── modules/
│   ├── user/
│   │   ├── index.js                          — public API
│   │   ├── model/
│   │   │   └── User.js
│   │   ├── repository/
│   │   │   └── userRepository.js
│   │   ├── services/
│   │   │   └── userServices.js
│   │   ├── controller/
│   │   │   └── userController.js
│   │   ├── routes/
│   │   │   └── userRoutes.js
│   │   └── dto/
│   │       └── userDto.js
│   │
│   ├── auth/
│   │   ├── index.js
│   │   ├── model/
│   │   │   └── RefreshToken.js
│   │   ├── repository/
│   │   │   └── refreshTokenRepository.js
│   │   ├── services/
│   │   │   └── authServices.js
│   │   ├── controller/
│   │   │   └── authController.js
│   │   ├── routes/
│   │   │   └── authRoutes.js
│   │   ├── dto/
│   │   │   └── authDto.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── constants/
│   │   │   └── auth.js
│   │   ├── utils/
│   │   │   └── cookieOptions.js
│   │   └── providers/
│   │       ├── google.js
│   │       └── index.js
│   │
│   └── billing/
│       ├── index.js
│       ├── model/
│       │   ├── Subscription.js
│       │   └── Payment.js
│       ├── repository/
│       │   ├── subscriptionRepository.js
│       │   └── paymentRepository.js
│       ├── services/
│       │   ├── billingServices.js
│       │   └── planServices.js
│       ├── controller/
│       │   └── billingController.js
│       ├── routes/
│       │   └── billingRoutes.js
│       ├── dto/
│       │   └── billingDto.js
│       ├── middleware/
│       │   └── plan.js
│       ├── constants/
│       │   └── billing.js
│       ├── hooks/
│       │   └── productHooks.js
│       └── providers/
│           ├── creem.js
│           └── index.js
│
├── models/
│   └── Task.js                               — example business model
├── repository/
│   └── taskRepository.js                     — example
├── services/
│   └── taskServices.js                       — example
├── controllers/
│   └── taskController.js                     — example
├── routes/
│   ├── routes.js                             — main router (mounts modules + business routes)
│   └── subroutes/
│       └── taskRoutes.js                     — example
├── middleware/
│   └── taskMiddleware.js                     — example
├── dto/
│   └── taskDto.js                            — example
├── constants/
│   └── task.js                               — example
├── providers/
│   └── exampleProvider.js                    — example (external API integration pattern)
│
└── shared/
    ├── utils/
    │   ├── fp.js
    │   ├── duration.js
    │   ├── http/
    │   │   ├── httpResponse.js
    │   │   ├── httpError.js
    │   │   ├── httpStatus.js
    │   │   └── httpUtils.js
    │   └── validation/
    │       ├── requestValidation.js
    │       └── validators.js
    └── constants/
        └── validation.js
```

## File Migration Map

### User Module

| Current | New |
|---------|-----|
| `src/models/User.js` | `src/modules/user/model/User.js` |
| `src/repository/userRepository.js` | `src/modules/user/repository/userRepository.js` |
| `src/services/userServices.js` | `src/modules/user/services/userServices.js` |
| `src/controllers/userController.js` | `src/modules/user/controller/userController.js` |
| `src/routes/subroutes/userRoutes.js` | `src/modules/user/routes/userRoutes.js` |
| `src/dto/userDto.js` | `src/modules/user/dto/userDto.js` |
| — (new) | `src/modules/user/index.js` |

### Auth Module

| Current | New |
|---------|-----|
| `src/models/RefreshToken.js` | `src/modules/auth/model/RefreshToken.js` |
| `src/repository/refreshTokenRepository.js` | `src/modules/auth/repository/refreshTokenRepository.js` |
| `src/services/authServices.js` | `src/modules/auth/services/authServices.js` |
| `src/controllers/authController.js` | `src/modules/auth/controller/authController.js` |
| `src/routes/subroutes/authRoutes.js` | `src/modules/auth/routes/authRoutes.js` |
| `src/dto/authDto.js` | `src/modules/auth/dto/authDto.js` |
| `src/middleware/auth.js` | `src/modules/auth/middleware/auth.js` |
| `src/constants/auth.js` | `src/modules/auth/constants/auth.js` |
| `src/utils/cookieOptions.js` | `src/modules/auth/utils/cookieOptions.js` |
| `src/providers/auth/google.js` | `src/modules/auth/providers/google.js` |
| `src/providers/auth/index.js` | `src/modules/auth/providers/index.js` |
| — (new) | `src/modules/auth/index.js` |

### Billing Module

| Current | New |
|---------|-----|
| `src/models/Subscription.js` | `src/modules/billing/model/Subscription.js` |
| `src/models/Payment.js` | `src/modules/billing/model/Payment.js` |
| `src/repository/subscriptionRepository.js` | `src/modules/billing/repository/subscriptionRepository.js` |
| `src/repository/paymentRepository.js` | `src/modules/billing/repository/paymentRepository.js` |
| `src/services/billingServices.js` | `src/modules/billing/services/billingServices.js` |
| `src/services/planServices.js` | `src/modules/billing/services/planServices.js` |
| `src/controllers/billingController.js` | `src/modules/billing/controller/billingController.js` |
| `src/routes/subroutes/billingRoutes.js` | `src/modules/billing/routes/billingRoutes.js` |
| `src/dto/billingDto.js` | `src/modules/billing/dto/billingDto.js` |
| `src/middleware/plan.js` | `src/modules/billing/middleware/plan.js` |
| `src/constants/billing.js` | `src/modules/billing/constants/billing.js` |
| `src/services/billing/hooks.js` | `src/modules/billing/hooks/productHooks.js` |
| `src/providers/billing/creem.js` | `src/modules/billing/providers/creem.js` |
| `src/providers/billing/index.js` | `src/modules/billing/providers/index.js` |
| — (new) | `src/modules/billing/index.js` |

### Shared

| Current | New |
|---------|-----|
| `src/utils/fp.js` | `src/shared/utils/fp.js` |
| `src/utils/duration.js` | `src/shared/utils/duration.js` |
| `src/utils/http/httpResponse.js` | `src/shared/utils/http/httpResponse.js` |
| `src/utils/http/httpError.js` | `src/shared/utils/http/httpError.js` |
| `src/utils/http/httpStatus.js` | `src/shared/utils/http/httpStatus.js` |
| `src/utils/http/httpUtils.js` | `src/shared/utils/http/httpUtils.js` |
| `src/utils/validation/requestValidation.js` | `src/shared/utils/validation/requestValidation.js` |
| `src/utils/validation/validators.js` | `src/shared/utils/validation/validators.js` |
| `src/constants/validation.js` | `src/shared/constants/validation.js` |

### Stays in Place

| File | Reason |
|------|--------|
| `src/app.js` | Entry point |
| `src/db.js` | DB connection |
| `src/routes/routes.js` | Main router for modules + business routes |

## Module Public API Contract

Each module's `index.js` exports only what external consumers need.

**Note:** `userServices.js` currently exports `getUser` (takes a filter object like `{ email }`), not `getUserByEmail`. During migration, `authServices.js` and `billingServices.js` must be refactored to stop importing `userRepository` directly and instead use the user module's public API through `index.js`.

**Export style note:** All existing service files and middleware use `export default` (an object or single value). The `index.js` files import the default and re-export as named members. During migration, all affected files must be refactored from `export default { fn1, fn2 }` to individual named exports (`export const fn1 = ...`). This enables clean `export { X } from '...'` re-exports in `index.js`.

Affected files that need `export default` → named exports refactoring:
- `userServices.js` — `export default { createUser, getUserById, getUser, updateUser, deleteUser }` → individual named exports
- `userDto.js` — `export default { toDTO }` → `export const toUserDto = ...` (renamed for clarity in public API)
- `authServices.js` — same pattern as userServices
- `authDto.js` — same pattern (internal only, but needed for intra-module named imports)
- `billingServices.js` — same pattern
- `billingDto.js` — same pattern (internal only)
- `planServices.js` — same pattern
- `billing/hooks.js` → `productHooks.js` — same pattern
- `middleware/auth.js` — `export default authMiddleware` → `export const authMiddleware = ...`

Note: `middleware/plan.js` already uses named exports (`export { requireFeature, requirePlan, attachPlan }`) — no changes needed.

**Intra-module import updates:** When a file is refactored from `export default` to named exports, ALL consumers of that file must also update their imports — both cross-module and intra-module. For example, `userController.js` currently does `import userServices from '../services/userServices.js'` and calls `userServices.getUserById()`. After refactoring, it must change to `import { getUserById } from '../services/userServices.js'`.

Known intra-module import sites that need updating:
- `userController.js` → imports `userServices` as default
- `billingController.js` → imports `billingServices` as default
- `billingServices.js` → imports `planServices` as default, `billingHooks` as default
- `middleware/auth.js` → imports `authServices` as default
- `authServices.js` → imports `parseDurationMs` from `duration.js` (path changes to `../../../shared/utils/duration.js`)

### modules/user/index.js

```js
export { getUserById, getUser, createUser, updateUser } from './services/userServices.js';
export { toUserDto } from './dto/userDto.js';  // renamed from toDTO for clarity
export { default as userRouter } from './routes/userRoutes.js';
```

Note: `deleteUser` is intentionally kept private. If business logic needs it, add it to `index.js` at that time.

### modules/auth/index.js

```js
export { authMiddleware } from './middleware/auth.js';
export { verifyAccessToken } from './services/authServices.js';
export { default as authRouter } from './routes/authRoutes.js';
```

Note: `authDto.js` is only used internally (by `refreshTokenRepository.js`), so it is NOT exported.

### modules/billing/index.js

```js
export { requireFeature, requirePlan, attachPlan } from './middleware/plan.js';
export { getUserPlan } from './services/planServices.js';
export { default as billingRouter } from './routes/billingRoutes.js';
```

## Required Refactoring (Inter-Module Imports)

The following files currently import `userRepository` directly. During migration, they must be refactored to use the user module's public API instead:

### authServices.js

| Current (direct repo call) | New (through user/index.js) |
|---|---|
| `import userRepository from "../repository/userRepository.js"` | `import { getUser, updateUser, createUser, getUserById } from '../user/index.js'` |
| `userRepository.getUser({ email: profile.email })` | `getUser({ email: profile.email })` |
| `userRepository.updateUser(existing.id, { ... })` | `updateUser(existing.id, { ... })` |
| `userRepository.createUser(...)` | `createUser(...)` |
| `userRepository.getUserById(stored.userId)` | `getUserById(stored.userId)` |

### billingServices.js

| Current (direct repo call) | New (through user/index.js) |
|---|---|
| `import userRepository from "../repository/userRepository.js"` | `import { getUser, getUserById } from '../user/index.js'` |
| `userRepository.getUser({ email: data.customer_email })` | `getUser({ email: data.customer_email })` |
| `userRepository.getUserById(result.before.userId)` | `getUserById(result.before.userId)` |

## Dependency Graph

```
modules/auth ──→ modules/user/index.js     (getUser, createUser, updateUser, getUserById)
modules/auth ──→ shared/utils/duration.js   (parseDurationMs in cookieOptions.js)

modules/billing ──→ modules/user/index.js   (getUser, getUserById)

modules/user ──→ (no module dependencies)

All modules ──→ shared/utils/*              (http, fp, validation)

Business logic (src/services/*, src/controllers/*):
  ──→ modules/*/index.js        (through public API only)
  ──→ shared/*                  (utilities)
```

## Isolation Rules

1. **Inter-module imports only through `index.js`** — `import { X } from '../user/index.js'` is allowed; `import { X } from '../user/repository.js'` is forbidden
2. **Intra-module imports are unrestricted** — files within the same module can import each other freely (e.g., `billing/controller/` can import from `billing/providers/` directly)
3. **Private internals stay private** — constants, utils, providers inside a module are not exported unless explicitly needed
4. **`shared/` is for genuinely shared code** — if a utility is used by only one module, it lives inside that module
5. **Root directories are for business logic** — `src/models/`, `src/services/`, etc. contain project-specific code, not module code
6. **`routes/routes.js` is the single entry point** — mounts both module routers and business routers

## Enforcement (Future)

ESLint `no-restricted-imports` rule can enforce the `index.js`-only import rule:

```js
// .eslintrc — example for future enforcement
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["**/modules/*/model/*", "**/modules/*/repository/*", "**/modules/*/services/*"],
          "message": "Import from module's index.js instead"
        }
      ]
    }]
  }
}
```

## Task Example Files

Each root directory contains a working Task example (CRUD: title, description, status, userId) demonstrating:

- The layer's responsibility and patterns
- How to import from modules (e.g., auth middleware from `modules/auth/index.js`)
- How to use shared utilities (httpResponse, validation)
- Comments explaining what to adapt for a real entity

Files created:
- `src/models/Task.js` — Mongoose schema example
- `src/repository/taskRepository.js` — DB access layer example
- `src/services/taskServices.js` — Business logic example
- `src/controllers/taskController.js` — HTTP handler example
- `src/routes/subroutes/taskRoutes.js` — Route definitions example
- `src/middleware/taskMiddleware.js` — Custom middleware example
- `src/dto/taskDto.js` — Response transformer example
- `src/constants/task.js` — Constants/config example
- `src/providers/exampleProvider.js` — External API integration example

## Import Path Updates

All internal imports within moved files must be updated to reflect new paths. Key changes:

- Module files importing from `shared/` — relative paths change (e.g., `../../utils/http/` → `../../../shared/utils/http/`)
- Module files importing from other modules — go through `index.js` (e.g., `../../repository/userRepository.js` → `../user/index.js`)
- `routes/routes.js` — imports routers from `modules/*/index.js` instead of `subroutes/*`
- `app.js` — no change (still imports from `routes/routes.js`)

## Migration Order

Modules must be migrated in dependency order — leaf modules first:

1. **`shared/`** — move utils, http, validation, fp, duration, constants/validation. No dependencies on modules.
2. **`modules/user/`** — move all user files. Refactor `userServices.js` from `export default { ... }` to individual named exports. Create `index.js`. No dependencies on other modules.
3. **`modules/auth/`** — move all auth files. Refactor `authServices.js` exports to named exports. Refactor `authServices.js` to import from `../user/index.js` instead of `userRepository` directly. Refactor `middleware/auth.js` from `export default` to named export. Update `cookieOptions.js` import path for `duration.js` → `shared/utils/duration.js`. Create `index.js`.
4. **`modules/billing/`** — move all billing files. Refactor `billingServices.js`, `planServices.js`, `middleware/plan.js`, `hooks.js` exports to named exports. Refactor `billingServices.js` to import from `../user/index.js` instead of `userRepository` directly. Rename `hooks.js` → `productHooks.js`. Create `index.js`.
5. **`routes/routes.js`** — update to import routers from `modules/*/index.js` instead of `subroutes/*`.
6. **Task examples** — create example files in root directories.
7. **Verify** — run the app, check all imports resolve.
8. **Update `CLAUDE.md`** — reflect new modular structure (project structure section, file responsibilities, module docs).

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Broken imports after move | Update all import paths; run app to verify. Migrate in dependency order (shared → user → auth → billing) |
| Circular dependencies between modules | Current graph is acyclic (auth→user, billing→user); user has no module deps |
| Discipline erosion (importing internals) | Add ESLint rule when team grows |
| `index.js` becomes bloated | Only export what's needed externally; review periodically |
| `cookieOptions.js` depends on `shared/duration.js` | Documented in dependency graph; if other modules need cookie options in future, consider moving to shared |
