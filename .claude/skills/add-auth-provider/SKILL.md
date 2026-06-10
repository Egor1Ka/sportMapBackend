---
name: add-auth-provider
description: Adds a new OAuth provider to BackendTemplate. Use when connecting a new login method (GitHub, Facebook, Apple, etc.).
---

Add a new OAuth provider to BackendTemplate. Follow the project pattern strictly.

## Auth Architecture

```
src/modules/auth/
├── providers/              — OAuth HTTP integrations (one file = one provider)
│   ├── google.js           — reference implementation
│   └── index.js            — provider registry: PROVIDERS = { google, ... }
├── controller/
│   └── authController.js   — HTTP handlers: login, callback, refresh, logout
├── routes/
│   └── authRoutes.js       — routes for /auth/*
├── services/
│   └── authServices.js     — JWT, state, findOrCreateUser, createSession
└── utils/
    └── cookieOptions.js    — cookie config
```

## Provider Contract — Required Shape

Every provider exports an object with **exactly these 3 keys** (generic names, not provider-specific).
This is what makes `buildProviderLoginHandler` / `buildProviderCallbackHandler` work for any provider.

```js
export default {
  buildAuthUrl(state)   → String   // redirect URL for the user
  exchangeCode(code)    → Object   // raw token response from provider
  getProfile(tokens)    → {        // normalized profile — always this exact shape
    providerUserId: String,
    email: String,
    name: String,
    avatar: String,
  }
}
```

Internal function names stay provider-specific (`buildGoogleAuthUrl` etc.) — only the **export keys** must be generic.

## Step 1 — Gather Info

Ask the user for:
- Provider name (e.g. `github`, `facebook`)
- `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI` — already in `.env` or need to be added

## Step 2 — Study the Reference

Read `src/modules/auth/providers/google.js` — this is the template to follow.

## Step 3 — Create the Provider File

Create `src/modules/auth/providers/<name>.js`:

```js
const { <NAME>_CLIENT_ID, <NAME>_CLIENT_SECRET, <NAME>_REDIRECT_URI } = process.env;

const <NAME>_AUTH_URL  = "...";
const <NAME>_TOKEN_URL = "...";
const <NAME>_USER_URL  = "...";

const build<Name>AuthUrl = (state) => {
  const params = new URLSearchParams({ client_id: <NAME>_CLIENT_ID, ... state });
  return `${<NAME>_AUTH_URL}?${params.toString()}`;
};

const exchange<Name>Code = async (code) => {
  // POST to token endpoint, return response.json()
};

const fetch<Name>UserInfo = async (accessToken) => {
  // GET to userinfo endpoint with Bearer token
};

const normalize<Name>Profile = (raw) => ({
  providerUserId: String(raw.<id_field>),
  email: raw.email,
  name: raw.name,
  avatar: raw.<avatar_field>,
});

const get<Name>Profile = async (tokens) => {
  const raw = await fetch<Name>UserInfo(tokens.access_token);
  return normalize<Name>Profile(raw);
};

// Export keys must be generic — the controller uses buildAuthUrl / exchangeCode / getProfile
export default {
  buildAuthUrl: build<Name>AuthUrl,
  exchangeCode: exchange<Name>Code,
  getProfile:   get<Name>Profile,
};
```

## Step 4 — Register in the Registry

In `src/modules/auth/providers/index.js` add one line:

```js
import <name> from "./<name>.js";

const PROVIDERS = {
  google,
  <name>,   // ← add
};
```

## Step 5 — Add Handlers to the Controller

In `src/modules/auth/controller/authController.js` add two lines using the existing factory functions.
No boilerplate — the factories handle all the logic:

```js
const handle<Name>Login    = buildProviderLoginHandler("<name>");
const handle<Name>Callback = buildProviderCallbackHandler("<name>");
```

Add both to the named exports at the bottom of the file:

```js
export { ..., handle<Name>Login, handle<Name>Callback };
```

## Step 6 — Add Routes

In `src/modules/auth/routes/authRoutes.js`:

Import the new handlers:
```js
import { ..., handle<Name>Login, handle<Name>Callback } from "../controller/authController.js";
```

Add routes:
```js
router.get("/<name>",          handle<Name>Login);
router.get("/<name>/callback", handle<Name>Callback);
```

## Step 7 — Add Environment Variables

In `.env.example`:

```
<NAME>_CLIENT_ID=
<NAME>_CLIENT_SECRET=
<NAME>_REDIRECT_URI=http://localhost:9000/api/auth/<name>/callback
```

## Step 8 — Verify

- All imports are correct
- Provider contract is satisfied (providerUserId, email, name, avatar)
- Show the final list of created/modified files
