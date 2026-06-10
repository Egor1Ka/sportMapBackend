# Cloudinary Avatars — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать загрузку, замену и удаление личных и per-org аватарок юзеров через Cloudinary.

**Architecture:** Новый модуль `src/modules/media/` инкапсулирует Cloudinary за интерфейсом `{ upload, delete }`. Эндпоинты `POST/DELETE /api/user/avatar` живут в user-модуле, `POST/DELETE /api/org/:orgId/staff/:staffId/avatar` — в org-роутах. Multer (memoryStorage) принимает multipart, лимиты по размеру резолвятся динамически из `ASSET_LIMITS[assetType]`.

**Tech Stack:** Express 5, Mongoose 8, ES modules, Ramda, Cloudinary SDK, multer.

**Spec:** `Slotix-fronted/docs/superpowers/specs/2026-04-27-cloudinary-avatars-design.md` (секции 3 и 6).

---

## File Structure

### Создаются:
- `src/modules/media/index.js` — public API
- `src/modules/media/constants/media.js` — `ASSET_LIMITS`, `ASSET_TYPES`
- `src/modules/media/providers/cloudinary.js` — реализация контракта `{ upload, delete }`
- `src/modules/media/providers/index.js` — реестр провайдеров
- `src/modules/media/services/mediaServices.js` — `uploadAvatar`, `deleteAvatar` (провайдер-агностик)
- `src/modules/media/middleware/upload.js` — multer-фабрика по `assetType`
- `src/modules/media/__tests__/mediaServices.test.js` — unit-тесты сервиса с моком провайдера
- `src/modules/media/__tests__/setup.js` — копия паттерна из billing tests

### Модифицируются:
- `package.json` — добавить `cloudinary`, `multer`
- `.env.example` — добавить `CLOUDINARY_*`
- `src/models/Membership.js` — добавить поле `avatar`
- `src/modules/user/controller/userController.js` — добавить `uploadAvatar`, `deleteAvatar`
- `src/modules/user/routes/userRoutes.js` — зарегистрировать роуты
- `src/routes/subroutes/orgRoutes.js` — добавить роуты `/staff/:staffId/avatar`
- DTO для membership и staff — включить `avatar` в ответ

---

## Phase 0 — Setup

### Task 1: Установить зависимости

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install cloudinary + multer**

```bash
cd /Users/egorzozula/Desktop/BackendTemplate
npm install cloudinary multer
```

Expected: deps добавлены в `package.json` под `dependencies`.

- [ ] **Step 2: Verify versions in package.json**

```bash
grep -E '"(cloudinary|multer)"' package.json
```

Expected: оба пакета присутствуют.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add cloudinary and multer for media uploads"
```

---

### Task 2: Дополнить .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Добавить переменные**

Добавить в конец `.env.example`:

```
# ===========================================
# Cloudinary (media uploads)
# ===========================================
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore(env): document CLOUDINARY_* variables"
```

---

### Task 3: Добавить поле `avatar` в Membership

**Files:**
- Modify: `src/models/Membership.js`

- [ ] **Step 1: Добавить поле в схему**

В `MembershipSchema`, после поля `displayName`, добавить:

```js
/**
 * Per-org аватарка юзера. Если пусто — фронт показывает букву (фолбэк).
 * URL уже с прибитыми Cloudinary трансформациями (c_fill,g_face,w_400,h_400).
 */
avatar: { type: String, default: "" },
```

- [ ] **Step 2: Verify schema parses**

```bash
node -e "import('./src/models/Membership.js').then(m => console.log('ok', Object.keys(m.default.schema.paths)))" 2>&1 | head -5
```

Expected: вывод включает `avatar` в списке путей.

- [ ] **Step 3: Commit**

```bash
git add src/models/Membership.js
git commit -m "feat(membership): add avatar field for per-org user avatars"
```

---

## Phase 1 — Media Module Foundation

### Task 4: Создать константы media

**Files:**
- Create: `src/modules/media/constants/media.js`

- [ ] **Step 1: Создать файл**

```js
// src/modules/media/constants/media.js

/**
 * Типы ассетов, которые мы умеем загружать.
 * Используется для выбора папки в провайдере и резолва лимитов.
 */
export const ASSET_TYPES = Object.freeze({
  USER_AVATAR: "user-avatar",
  STAFF_AVATAR: "staff-avatar",
});

/**
 * Лимиты по типу ассета — централизованно, чтобы для разных сущностей
 * (аватарки / лого орг / фото услуг) ставить разные ограничения.
 */
export const ASSET_LIMITS = Object.freeze({
  [ASSET_TYPES.USER_AVATAR]: {
    maxBytes: 2 * 1024 * 1024,
    mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  [ASSET_TYPES.STAFF_AVATAR]: {
    maxBytes: 2 * 1024 * 1024,
    mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
});

/**
 * Резолвит лимиты по assetType. Бросает если тип неизвестен —
 * лучше упасть громко, чем тихо принять что-то странное.
 */
export const getAssetLimits = (assetType) => {
  const limits = ASSET_LIMITS[assetType];
  if (!limits) {
    throw new Error(`Unknown assetType: ${assetType}`);
  }
  return limits;
};
```

- [ ] **Step 2: Smoke check**

```bash
node -e "import('./src/modules/media/constants/media.js').then(m => console.log(m.getAssetLimits('user-avatar')))"
```

Expected: `{ maxBytes: 2097152, mimes: [...] }`

- [ ] **Step 3: Commit**

```bash
git add src/modules/media/constants/media.js
git commit -m "feat(media): add ASSET_TYPES and ASSET_LIMITS constants"
```

---

### Task 5: Создать Cloudinary провайдер

**Files:**
- Create: `src/modules/media/providers/cloudinary.js`

- [ ] **Step 1: Создать провайдер**

```js
// src/modules/media/providers/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import { ASSET_TYPES } from "../constants/media.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Папки в Cloudinary детерминистичны от ownerId, чтобы повторный аплоад
 * перезаписывал старый файл (overwrite: true) и нам не нужно было хранить
 * provider_id в БД.
 */
const buildPublicId = (assetType, ownerId) => {
  if (assetType === ASSET_TYPES.USER_AVATAR) {
    return `slotix/avatars/users/${ownerId}`;
  }
  if (assetType === ASSET_TYPES.STAFF_AVATAR) {
    // ownerId формата `${orgId}/${staffId}`
    return `slotix/avatars/staff/${ownerId}`;
  }
  throw new Error(`Unknown assetType for publicId: ${assetType}`);
};

const AVATAR_TRANSFORMATION = [
  { width: 400, height: 400, crop: "fill", gravity: "face" },
  { quality: "auto", fetch_format: "auto" },
];

const uploadStream = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    stream.end(buffer);
  });

/**
 * Залить файл в Cloudinary. Возвращает URL уже с трансформациями для аватарок.
 */
const upload = async (file, { assetType, ownerId }) => {
  const publicId = buildPublicId(assetType, ownerId);
  const result = await uploadStream(file.buffer, {
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
    invalidate: true,
  });

  const url = cloudinary.url(result.public_id, {
    secure: true,
    version: result.version,
    transformation: AVATAR_TRANSFORMATION,
  });

  return { url, providerId: result.public_id };
};

/**
 * Удалить из Cloudinary. providerId передаётся как public_id.
 */
const remove = async (providerId) => {
  await cloudinary.uploader.destroy(providerId, { invalidate: true });
};

/**
 * Хелпер чтобы из (assetType, ownerId) получить providerId без хранения в БД.
 * Нужен для DELETE — мы знаем ownerId из request, но не providerId.
 */
const buildProviderId = (assetType, ownerId) => buildPublicId(assetType, ownerId);

export default { upload, delete: remove, buildProviderId };
```

- [ ] **Step 2: Smoke import**

```bash
node --env-file=.env -e "import('./src/modules/media/providers/cloudinary.js').then(m => console.log('exports:', Object.keys(m.default)))"
```

Expected: `exports: [ 'upload', 'delete', 'buildProviderId' ]`. Может вылезти warning про отсутствие env-переменных Cloudinary — ок, конфиг читается лениво при первом вызове.

- [ ] **Step 3: Commit**

```bash
git add src/modules/media/providers/cloudinary.js
git commit -m "feat(media): add cloudinary provider implementing upload/delete contract"
```

---

### Task 6: Создать реестр провайдеров

**Files:**
- Create: `src/modules/media/providers/index.js`

- [ ] **Step 1: Создать реестр**

```js
// src/modules/media/providers/index.js
import cloudinary from "./cloudinary.js";

export const PROVIDERS = Object.freeze({
  cloudinary,
});

/**
 * Активный провайдер — выбирается через env. Дефолт cloudinary.
 * Когда добавим S3 / R2 — просто меняем env.
 */
export const getActiveProvider = () => {
  const name = process.env.MEDIA_PROVIDER || "cloudinary";
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown MEDIA_PROVIDER: ${name}`);
  }
  return provider;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/media/providers/index.js
git commit -m "feat(media): add provider registry with env-based selection"
```

---

### Task 7: Создать mediaServices

**Files:**
- Create: `src/modules/media/services/mediaServices.js`

- [ ] **Step 1: Реализовать сервисные функции**

```js
// src/modules/media/services/mediaServices.js
import { getActiveProvider } from "../providers/index.js";
import { getAssetLimits } from "../constants/media.js";

/**
 * Залить аватарку. Сервис не знает про конкретного провайдера.
 *
 * @param {Object} params
 * @param {'user-avatar'|'staff-avatar'} params.assetType
 * @param {string} params.ownerId  — для user-avatar = userId, для staff-avatar = `${orgId}/${staffId}`
 * @param {{ buffer: Buffer, mimetype: string, size: number, originalname: string }} params.file
 * @returns {Promise<{ url: string, providerId: string }>}
 */
export const uploadAvatar = async ({ assetType, ownerId, file }) => {
  if (!file || !file.buffer) {
    throw new Error("uploadAvatar: file.buffer required");
  }
  const limits = getAssetLimits(assetType);
  if (!limits.mimes.includes(file.mimetype)) {
    const err = new Error(`Mime ${file.mimetype} not allowed`);
    err.code = "INVALID_MIME";
    throw err;
  }
  if (file.size > limits.maxBytes) {
    const err = new Error(`File size ${file.size} exceeds ${limits.maxBytes}`);
    err.code = "FILE_TOO_LARGE";
    throw err;
  }

  const provider = getActiveProvider();
  return provider.upload(file, { assetType, ownerId });
};

/**
 * Удалить аватарку из хранилища. Идемпотентно — если файла нет, не падаем.
 */
export const deleteAvatar = async ({ assetType, ownerId }) => {
  const provider = getActiveProvider();
  const providerId = provider.buildProviderId(assetType, ownerId);
  try {
    await provider.delete(providerId);
  } catch (err) {
    // не критично если файла уже нет — главное, чтобы поле в БД зачистилось выше
    if (err && err.http_code !== 404) {
      throw err;
    }
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/media/services/mediaServices.js
git commit -m "feat(media): add uploadAvatar/deleteAvatar services with validation"
```

---

### Task 8: Написать unit-тесты для mediaServices

**Files:**
- Create: `src/modules/media/__tests__/mediaServices.test.js`

- [ ] **Step 1: Скопировать паттерн setup из billing**

```bash
cp src/modules/billing/__tests__/setup.js src/modules/media/__tests__/setup.js
cp src/modules/billing/__tests__/helpers.js src/modules/media/__tests__/helpers.js 2>/dev/null || true
```

Эти файлы могут не пригодиться напрямую — оставляем для совместимости с testRunner-ом, можно потом удалить лишнее.

- [ ] **Step 2: Написать падающий тест**

```js
// src/modules/media/__tests__/mediaServices.test.js
import { test } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

// Мок провайдера до импорта сервиса
mock.module("../providers/index.js", {
  namedExports: {
    getActiveProvider: () => ({
      upload: async (file, { assetType, ownerId }) => ({
        url: `https://mock.test/${assetType}/${ownerId}`,
        providerId: `${assetType}/${ownerId}`,
      }),
      delete: async () => {},
      buildProviderId: (assetType, ownerId) => `${assetType}/${ownerId}`,
    }),
    PROVIDERS: {},
  },
});

const { uploadAvatar, deleteAvatar } = await import(
  "../services/mediaServices.js"
);

test("uploadAvatar возвращает URL и providerId от провайдера", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "image/jpeg",
    size: 100,
    originalname: "x.jpg",
  };
  const result = await uploadAvatar({
    assetType: "user-avatar",
    ownerId: "user123",
    file,
  });
  assert.strictEqual(result.url, "https://mock.test/user-avatar/user123");
  assert.strictEqual(result.providerId, "user-avatar/user123");
});

test("uploadAvatar отвергает чужой mime", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "application/pdf",
    size: 100,
    originalname: "x.pdf",
  };
  await assert.rejects(
    () =>
      uploadAvatar({ assetType: "user-avatar", ownerId: "user123", file }),
    (err) => err.code === "INVALID_MIME",
  );
});

test("uploadAvatar отвергает превышение размера", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "image/jpeg",
    size: 3 * 1024 * 1024,
    originalname: "x.jpg",
  };
  await assert.rejects(
    () =>
      uploadAvatar({ assetType: "user-avatar", ownerId: "user123", file }),
    (err) => err.code === "FILE_TOO_LARGE",
  );
});

test("uploadAvatar бросает на неизвестный assetType", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "image/jpeg",
    size: 100,
    originalname: "x.jpg",
  };
  await assert.rejects(() =>
    uploadAvatar({ assetType: "unknown-type", ownerId: "u", file }),
  );
});

test("deleteAvatar не падает если провайдер отдаёт 404", async () => {
  // дефолтный мок не падает — проверяем что вызов проходит без ошибки
  await assert.doesNotReject(() =>
    deleteAvatar({ assetType: "user-avatar", ownerId: "user123" }),
  );
});
```

- [ ] **Step 3: Запустить тесты — должны пройти**

```bash
node --experimental-test-module-mocks --test src/modules/media/__tests__/mediaServices.test.js
```

Expected: все 5 тестов проходят (PASS).

- [ ] **Step 4: Добавить test:media в package.json**

В `package.json` → `scripts`, после `test:notifications`:

```json
"test:media": "node --experimental-test-module-mocks --test src/modules/media/__tests__/mediaServices.test.js",
```

- [ ] **Step 5: Verify**

```bash
npm run test:media
```

Expected: тесты проходят.

- [ ] **Step 6: Commit**

```bash
git add src/modules/media/__tests__/ package.json
git commit -m "test(media): add unit tests for uploadAvatar/deleteAvatar with mock provider"
```

---

### Task 9: Создать multer middleware

**Files:**
- Create: `src/modules/media/middleware/upload.js`

- [ ] **Step 1: Создать фабрику middleware**

```js
// src/modules/media/middleware/upload.js
import multer from "multer";
import { getAssetLimits } from "../constants/media.js";
import { httpError } from "../../../shared/utils/http/httpError.js";

/**
 * Создаёт multer middleware с лимитами по типу ассета.
 * Использование: router.post('/avatar', authMiddleware, uploadFor('user-avatar').single('file'), handler)
 */
export const uploadFor = (assetType) => {
  const limits = getAssetLimits(assetType);
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limits.maxBytes },
    fileFilter: (_req, file, cb) => {
      if (!limits.mimes.includes(file.mimetype)) {
        const err = new Error(
          `Invalid file format. Allowed: ${limits.mimes.join(", ")}`,
        );
        err.code = "INVALID_MIME";
        cb(err);
        return;
      }
      cb(null, true);
    },
  });
};

/**
 * Express error-handler для ошибок multer. Превращает их в стандартный
 * validationError формат.
 */
export const handleUploadError = (err, _req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large"
        : err.message || "Upload error";
    return httpError(res, 400, "validationError", { file: { error: message } });
  }
  if (err.code === "INVALID_MIME") {
    return httpError(res, 400, "validationError", {
      file: { error: err.message },
    });
  }
  return next(err);
};
```

- [ ] **Step 2: Verify httpError signature**

```bash
grep -n "export" src/shared/utils/http/httpError.js | head
```

Expected: видеть `httpError` функцию. Если её сигнатура отличается — поправить вызовы выше под фактическую (возможно `httpError(res, status, message, data)` или похожее).

- [ ] **Step 3: Commit**

```bash
git add src/modules/media/middleware/upload.js
git commit -m "feat(media): add multer middleware factory keyed by assetType"
```

---

### Task 10: Public API через media/index.js

**Files:**
- Create: `src/modules/media/index.js`

- [ ] **Step 1: Создать index.js**

```js
// src/modules/media/index.js
export { uploadAvatar, deleteAvatar } from "./services/mediaServices.js";
export { uploadFor, handleUploadError } from "./middleware/upload.js";
export { ASSET_TYPES } from "./constants/media.js";
```

- [ ] **Step 2: Smoke import**

```bash
node -e "import('./src/modules/media/index.js').then(m => console.log(Object.keys(m)))"
```

Expected: `['uploadAvatar', 'deleteAvatar', 'uploadFor', 'handleUploadError', 'ASSET_TYPES']`

- [ ] **Step 3: Commit**

```bash
git add src/modules/media/index.js
git commit -m "feat(media): expose public API from index.js"
```

---

## Phase 2 — User Avatar Endpoints

### Task 11: Добавить хендлеры в userController

**Files:**
- Modify: `src/modules/user/controller/userController.js`

- [ ] **Step 1: Прочитать текущий контроллер**

```bash
sed -n '1,30p' src/modules/user/controller/userController.js
```

Запомнить как именно импортированы httpResponse, httpError, generalStatus и как устроен типичный handler (req.user.id, asyncPipe, и т.д.).

- [ ] **Step 2: Импортировать сервисы**

В начало файла добавить:

```js
import { uploadAvatar, deleteAvatar, ASSET_TYPES } from "../../media/index.js";
```

- [ ] **Step 3: Реализовать хендлеры**

Добавить две функции (стиль — как у существующих handler'ов в этом файле, поправить под факт):

```js
/**
 * POST /api/user/avatar
 * Body: multipart/form-data с полем 'file'
 */
export const uploadUserAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return httpError(res, 400, "validationError", {
        file: { error: "File is required" },
      });
    }

    const userId = req.user.id;
    const { url } = await uploadAvatar({
      assetType: ASSET_TYPES.USER_AVATAR,
      ownerId: userId,
      file: req.file,
    });

    const updated = await updateUserService(userId, { avatar: url });
    return httpResponse(res, generalStatus.SUCCESS, toUserDto(updated));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/user/avatar
 */
export const deleteUserAvatar = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const current = await getUserService(userId);
    if (current?.avatar) {
      await deleteAvatar({
        assetType: ASSET_TYPES.USER_AVATAR,
        ownerId: userId,
      });
    }
    const updated = await updateUserService(userId, { avatar: "" });
    return httpResponse(res, generalStatus.SUCCESS, toUserDto(updated));
  } catch (err) {
    next(err);
  }
};
```

**Note:** в файле уже импортированы `getUser`, `updateUser`, `toUserDto` или их аналоги. Использовать существующие имена. Если в контроллере импортируются как `getUser`/`updateUser` без переименования — заменить `getUserService`/`updateUserService` на эти имена. Если конфликт с роут-хендлерами — переименовать импорты.

- [ ] **Step 4: Commit**

```bash
git add src/modules/user/controller/userController.js
git commit -m "feat(user): add uploadUserAvatar and deleteUserAvatar handlers"
```

---

### Task 12: Зарегистрировать роуты в userRoutes.js

**Files:**
- Modify: `src/modules/user/routes/userRoutes.js`

- [ ] **Step 1: Импортировать хендлеры и middleware**

В импорт-блок добавить:

```js
import { uploadUserAvatar, deleteUserAvatar } from "../controller/userController.js";
import { uploadFor, handleUploadError, ASSET_TYPES } from "../../media/index.js";
```

- [ ] **Step 2: Добавить роуты**

После `router.delete("/telegram/disconnect", ...)`:

```js
router.post(
  "/avatar",
  authMiddleware,
  uploadFor(ASSET_TYPES.USER_AVATAR).single("file"),
  handleUploadError,
  uploadUserAvatar,
);
router.delete("/avatar", authMiddleware, deleteUserAvatar);
```

**Critical:** `handleUploadError` должен идти СРАЗУ после `uploadFor(...).single('file')`, чтобы перехватить multer-ошибки до основного хендлера. Проверить что Express 5 корректно обрабатывает error-middleware в цепочке (4-арочная сигнатура).

- [ ] **Step 3: Запустить сервер и проверить health**

```bash
npm run dev &
sleep 3
curl -s http://localhost:9000/api/ | head -50
kill %1
```

Expected: `{"data":{"message":"API is running"}, ...}` — сервер стартует без ошибок импорта.

- [ ] **Step 4: Commit**

```bash
git add src/modules/user/routes/userRoutes.js
git commit -m "feat(user): wire POST/DELETE /api/user/avatar routes"
```

---

### Task 13: Manual curl test — личная аватарка

**Files:** —

- [ ] **Step 1: Получить тестовый accessToken**

Войти через `/api/auth/google` или существующий dev-flow. Скопировать `accessToken` cookie из браузера в переменную:

```bash
export TOKEN="<скопированный-accessToken>"
```

- [ ] **Step 2: Создать тестовую картинку**

```bash
curl -L -o /tmp/test-avatar.jpg "https://placekitten.com/500/500"
```

(Любой jpg <2 MB подойдёт.)

- [ ] **Step 3: Заполнить .env реальными CLOUDINARY_***

В `.env` добавить настоящие значения из cloudinary dashboard (зарегаться на cloudinary.com если ещё нет аккаунта).

- [ ] **Step 4: Запустить сервер**

```bash
npm run dev &
sleep 3
```

- [ ] **Step 5: Загрузить аватарку**

```bash
curl -X POST http://localhost:9000/api/user/avatar \
  -H "Cookie: accessToken=$TOKEN" \
  -F "file=@/tmp/test-avatar.jpg" -i
```

Expected: 200, JSON содержит `data.avatar` с URL вида `https://res.cloudinary.com/.../upload/c_fill,g_face,w_400,h_400,q_auto,f_auto/v.../slotix/avatars/users/<userId>.jpg`.

- [ ] **Step 6: Проверить URL открывается**

```bash
curl -sI "<URL-из-ответа>" | head -5
```

Expected: `HTTP/2 200`.

- [ ] **Step 7: Загрузить второй раз — должна перезаписаться**

```bash
curl -X POST http://localhost:9000/api/user/avatar \
  -H "Cookie: accessToken=$TOKEN" \
  -F "file=@/tmp/test-avatar.jpg" -i
```

Expected: 200, тот же `public_id` но новый `version` в URL.

- [ ] **Step 8: Удалить**

```bash
curl -X DELETE http://localhost:9000/api/user/avatar \
  -H "Cookie: accessToken=$TOKEN" -i
```

Expected: 200, `data.avatar === ""`.

- [ ] **Step 9: Проверить что в Cloudinary файл удалён**

В cloudinary dashboard → Media Library → `slotix/avatars/users/` — файла быть не должно.

- [ ] **Step 10: Загрузить файл >2 MB — должен отвергаться**

```bash
dd if=/dev/urandom of=/tmp/big.jpg bs=1M count=3
curl -X POST http://localhost:9000/api/user/avatar \
  -H "Cookie: accessToken=$TOKEN" \
  -F "file=@/tmp/big.jpg" -i
```

Expected: 400 `validationError` с `file.error: "File too large"`.

- [ ] **Step 11: Загрузить PDF — должен отвергаться**

```bash
echo "%PDF-fake" > /tmp/x.pdf
curl -X POST http://localhost:9000/api/user/avatar \
  -H "Cookie: accessToken=$TOKEN" \
  -F "file=@/tmp/x.pdf;type=application/pdf" -i
```

Expected: 400 `validationError`.

- [ ] **Step 12: Без авторизации — 401**

```bash
curl -X POST http://localhost:9000/api/user/avatar \
  -F "file=@/tmp/test-avatar.jpg" -i
```

Expected: 401 `unauthorized`.

- [ ] **Step 13: Остановить сервер**

```bash
kill %1
```

---

## Phase 3 — Staff (per-org) Avatar Endpoints

### Task 14: Найти существующий orgRoutes и DTO для staff/membership

**Files:** —

- [ ] **Step 1: Изучить структуру org-роутов**

```bash
sed -n '1,80p' src/routes/subroutes/orgRoutes.js
```

Запомнить:
- Где живёт логика `getMyMembership` (контроллер? сервис?)
- Где DTO для `membership` (если есть отдельный файл)
- Где `getStaff` хендлер и его DTO
- Как реализован authorization middleware для проверки owner/admin (если такой уже есть — переиспользовать; если нет — реализовать в этом же файле или вынести в helpers)

- [ ] **Step 2: Найти helper для проверки прав в орге**

```bash
grep -rn "isOrgAdmin\|isOwner\|requireOrgAccess" src/ 2>/dev/null | grep -v node_modules | head
```

Если есть готовый — использовать. Если нет — реализовать inline в новом контроллере (позже можно вынести).

---

### Task 15: Создать staff-avatar handlers

**Files:**
- Modify: `src/routes/subroutes/orgRoutes.js` (или соответствующий staff/org контроллер)

- [ ] **Step 1: Добавить импорты**

В файл с org-роутами добавить:

```js
import {
  uploadAvatar,
  deleteAvatar,
  uploadFor,
  handleUploadError,
  ASSET_TYPES,
} from "../../modules/media/index.js";
import Membership from "../../models/Membership.js";
```

(Путь относительный поправить по факту структуры.)

- [ ] **Step 2: Реализовать хендлеры**

```js
/**
 * Проверка: может ли currentUser менять аватарку staffId в orgId.
 * Разрешено если staffId === currentUser.id, либо currentUser имеет
 * membership в этой орг с ролью owner/admin и status active.
 */
const canEditStaffAvatar = async (currentUserId, orgId, staffId) => {
  if (String(currentUserId) === String(staffId)) return true;
  const myMembership = await Membership.findOne({
    userId: currentUserId,
    orgId,
    status: "active",
  });
  return Boolean(myMembership && (myMembership.role === "owner" || myMembership.role === "admin"));
};

const buildStaffOwnerId = (orgId, staffId) => `${orgId}/${staffId}`;

const toMembershipAvatarDto = (membership, position = null) => ({
  avatar: membership.avatar || "",
  displayName: membership.displayName || null,
  bio: membership.bio || null,
  role: membership.role,
  status: membership.status,
  position,
});

export const uploadStaffAvatar = async (req, res, next) => {
  try {
    const { orgId, staffId } = req.params;
    const allowed = await canEditStaffAvatar(req.user.id, orgId, staffId);
    if (!allowed) {
      return httpError(res, 403, "forbidden", {
        message: "Cannot edit this staff avatar",
      });
    }
    if (!req.file) {
      return httpError(res, 400, "validationError", {
        file: { error: "File is required" },
      });
    }

    const membership = await Membership.findOne({ userId: staffId, orgId });
    if (!membership) {
      return httpError(res, 404, "notFound", { message: "Membership not found" });
    }

    const { url } = await uploadAvatar({
      assetType: ASSET_TYPES.STAFF_AVATAR,
      ownerId: buildStaffOwnerId(orgId, staffId),
      file: req.file,
    });

    membership.avatar = url;
    await membership.save();

    // если в проекте есть populate position — подгрузить тут
    return httpResponse(res, generalStatus.SUCCESS, toMembershipAvatarDto(membership));
  } catch (err) {
    next(err);
  }
};

export const deleteStaffAvatar = async (req, res, next) => {
  try {
    const { orgId, staffId } = req.params;
    const allowed = await canEditStaffAvatar(req.user.id, orgId, staffId);
    if (!allowed) {
      return httpError(res, 403, "forbidden", {
        message: "Cannot edit this staff avatar",
      });
    }
    const membership = await Membership.findOne({ userId: staffId, orgId });
    if (!membership) {
      return httpError(res, 404, "notFound", { message: "Membership not found" });
    }
    if (membership.avatar) {
      await deleteAvatar({
        assetType: ASSET_TYPES.STAFF_AVATAR,
        ownerId: buildStaffOwnerId(orgId, staffId),
      });
    }
    membership.avatar = "";
    await membership.save();
    return httpResponse(res, generalStatus.SUCCESS, toMembershipAvatarDto(membership));
  } catch (err) {
    next(err);
  }
};
```

**Note:** Если в проекте handlers живут не inline в роутах а в отдельных контроллерах — соблюсти конвенцию. Поправить пути к моделям и httpResponse под факт.

- [ ] **Step 3: Зарегистрировать роуты**

В этом же файле, рядом с другими `router.<method>(...)`:

```js
router.post(
  "/:orgId/staff/:staffId/avatar",
  authMiddleware,
  uploadFor(ASSET_TYPES.STAFF_AVATAR).single("file"),
  handleUploadError,
  uploadStaffAvatar,
);
router.delete(
  "/:orgId/staff/:staffId/avatar",
  authMiddleware,
  deleteStaffAvatar,
);
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/subroutes/orgRoutes.js
git commit -m "feat(org): add per-org staff avatar upload/delete endpoints"
```

---

### Task 16: Обновить DTO для getMyMembership и getStaff

**Files:**
- Modify: org-controller / org-services / dto файлы (по факту структуры)

- [ ] **Step 1: Найти DTO**

```bash
grep -rn "getMyMembership\|toMembershipDto\|getStaff" src/ 2>/dev/null | grep -v node_modules | head -20
```

- [ ] **Step 2: В DTO `getMyMembership` добавить поле**

В функцию-маппер для membership:

```js
return {
  avatar: m.avatar || "",          // НОВОЕ
  role: m.role,
  status: m.status,
  displayName: m.displayName || null,
  bio: m.bio || null,
  positionId: m.positionId || null,
  position: positionName,
};
```

- [ ] **Step 3: В DTO `getStaff` добавить поле для каждого члена**

В маппер staff-member:

```js
return {
  // ...existing fields
  avatar: membership.avatar || "",   // НОВОЕ — НЕ каскадируем к user.avatar
};
```

- [ ] **Step 4: Manual curl test**

```bash
npm run dev &
sleep 3

# Получить my-membership — должен включать avatar
curl -s http://localhost:9000/api/org/<orgId>/my-membership \
  -H "Cookie: accessToken=$TOKEN" | head -30

# Получить staff — каждый должен включать avatar
curl -s http://localhost:9000/api/org/<orgId>/staff \
  -H "Cookie: accessToken=$TOKEN" | head -50

kill %1
```

Expected: оба эндпоинта возвращают поле `avatar` в каждом membership-объекте (пустая строка если не загружен).

- [ ] **Step 5: Commit**

```bash
git add <измененные DTO файлы>
git commit -m "feat(org): include per-org avatar in membership and staff DTOs"
```

---

### Task 17: Manual curl test — staff avatar

**Files:** —

- [ ] **Step 1: Запустить сервер**

```bash
npm run dev &
sleep 3
export ORG_ID="<существующий orgId>"
export STAFF_ID="<currentUser.id для самопроверки>"
```

- [ ] **Step 2: Загрузить аватарку для себя в орг**

```bash
curl -X POST "http://localhost:9000/api/org/$ORG_ID/staff/$STAFF_ID/avatar" \
  -H "Cookie: accessToken=$TOKEN" \
  -F "file=@/tmp/test-avatar.jpg" -i
```

Expected: 200, JSON с `data.avatar` ведущим на `slotix/avatars/staff/<orgId>/<staffId>.jpg`.

- [ ] **Step 3: Попытка загрузить чужую аватарку без admin-прав — 403**

Найти второго юзера со статусом member в этой орг, залогиниться им, попытаться загрузить аватарку для себя:

```bash
# должно работать (своя)
curl -X POST "http://localhost:9000/api/org/$ORG_ID/staff/$OTHER_STAFF_ID/avatar" \
  -H "Cookie: accessToken=$OTHER_TOKEN" \
  -F "file=@/tmp/test-avatar.jpg" -i
```

```bash
# а этот должно дать 403 (чужой member как другой member)
curl -X POST "http://localhost:9000/api/org/$ORG_ID/staff/$STAFF_ID/avatar" \
  -H "Cookie: accessToken=$OTHER_TOKEN" \
  -F "file=@/tmp/test-avatar.jpg" -i
```

Expected: первый запрос 200, второй 403 forbidden.

- [ ] **Step 4: Owner/admin может загрузить чужую аватарку**

Залогиниться owner/admin'ом, загрузить аватарку для другого member:

```bash
curl -X POST "http://localhost:9000/api/org/$ORG_ID/staff/$MEMBER_STAFF_ID/avatar" \
  -H "Cookie: accessToken=$ADMIN_TOKEN" \
  -F "file=@/tmp/test-avatar.jpg" -i
```

Expected: 200.

- [ ] **Step 5: DELETE staff avatar**

```bash
curl -X DELETE "http://localhost:9000/api/org/$ORG_ID/staff/$STAFF_ID/avatar" \
  -H "Cookie: accessToken=$TOKEN" -i
```

Expected: 200, `data.avatar === ""`. В Cloudinary файла больше нет.

- [ ] **Step 6: Membership не существует — 404**

```bash
curl -X POST "http://localhost:9000/api/org/$ORG_ID/staff/000000000000000000000000/avatar" \
  -H "Cookie: accessToken=$TOKEN" \
  -F "file=@/tmp/test-avatar.jpg" -i
```

Expected: 404 notFound. (Хотя `canEditStaffAvatar` тоже может вернуть `false` раньше — допустимо и 403, и 404; главное чтобы не 500.)

- [ ] **Step 7: Остановить сервер**

```bash
kill %1
```

---

## Phase 4 — Полная проверка

### Task 18: Финальный smoke test всего модуля

**Files:** —

- [ ] **Step 1: Прогнать все тесты**

```bash
npm run test:media
```

Expected: 5/5 PASS.

- [ ] **Step 2: Проверить что все эндпоинты работают**

Прогнать checklist из Task 13 (10 тестов) и Task 17 (5 тестов) ещё раз — итого 15 ручных проверок.

- [ ] **Step 3: Сверить с Acceptance Criteria из спека**

Открыть `Slotix-fronted/docs/superpowers/specs/2026-04-27-cloudinary-avatars-design.md`, секция 6 "Backend". Проверить каждый чекбокс:

- [ ] `npm install cloudinary multer` выполнен
- [ ] Membership.js имеет поле avatar
- [ ] Создан модуль src/modules/media/ по правилам Module Isolation
- [ ] Cloudinary-вызовы изолированы в providers/cloudinary.js
- [ ] 4 новых эндпоинта работают
- [ ] DTO getMyMembership и getStaff включают avatar
- [ ] Загрузка >2 MB → 400
- [ ] Загрузка не-картинки → 400
- [ ] Без авторизации → 401
- [ ] Чужая staff-аватарка не-админом → 403
- [ ] DELETE действительно удаляет из Cloudinary
- [ ] Повторная загрузка перезаписывает (overwrite: true)
- [ ] .env.example пополнен CLOUDINARY_*

- [ ] **Step 4: Финальный коммит-ярлык**

Если в процессе были не-закоммиченные правки:

```bash
git status
git add -A   # только если знаешь что не подтянулось ничего лишнего
git commit -m "chore(media): final cleanup after backend cloudinary integration"
```

---

## Done — Backend готов

После прохождения всех 18 задач бэкенд полностью реализует контракт из спека. Можно переходить к фронт-плану в `Slotix-fronted/docs/superpowers/plans/2026-04-27-cloudinary-avatars-frontend-plan.md`.
