# DTO in Repository — Design Spec

## Принцип

Репозиторий — единственная граница Mongoose. Всё что выходит из репозитория — plain object (DTO) или null. Сервисы и контроллеры никогда не видят Mongoose-документы.

## Поток данных

```
Mongoose doc → Repository (guard clause + DTO) → plain object → Service → Controller → httpResponse
```

## Правила

1. **DTO — чистый маппинг.** Никаких null-проверок и `toObject()` внутри. Принимает Mongoose-документ, возвращает plain object.
2. **Guard clause в репозитории.** Перед вызовом DTO репозиторий проверяет `if (!doc) return null`.
3. **`_id` → `id` в DTO.** Всё что выходит из репозитория, содержит `id` (строка), а не `_id` (ObjectId).
4. **ObjectId-поля → строки.** Поля-ссылки вроде `userId` тоже конвертируются в строки через `.toString()`. Для required-полей — без optional chaining. Для optional-полей — с явной проверкой.
5. **Один DTO на сущность.** Все бизнес-поля включены. Нет разделения на "internal" и "public".
6. **Контроллер не трансформирует.** Отдаёт то, что получил от сервиса. Импорт DTO в контроллере запрещён.
7. **delete-методы возвращают DTO** удалённого объекта (или null если не найден).
8. **Сервисы используют `id` вместо `_id`.** Все ссылки на `._id` в сервисах заменяются на `.id`.

## DTO-функции

### userDto.toDTO

Входные поля (User model): `_id`, `name`, `email`, `avatar`, `createdAt`, `updatedAt`.

```js
const toDTO = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  email: doc.email,
  avatar: doc.avatar,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
```

### billingDto.subscriptionToDTO

Входные поля (Subscription model): `_id`, `userId` (required), `creemSubscriptionId`, `creemCustomerId`, `productId`, `planKey`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAt`, `createdAt`, `updatedAt`.

```js
const subscriptionToDTO = (doc) => ({
  id: doc._id.toString(),
  userId: doc.userId.toString(),
  creemSubscriptionId: doc.creemSubscriptionId,
  creemCustomerId: doc.creemCustomerId,
  productId: doc.productId,
  planKey: doc.planKey,
  status: doc.status,
  currentPeriodStart: doc.currentPeriodStart,
  currentPeriodEnd: doc.currentPeriodEnd,
  cancelAt: doc.cancelAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
```

### billingDto.paymentToDTO

Входные поля (Payment model): `_id`, `userId` (optional), `creemSubscriptionId`, `creemEventId`, `productId`, `type`, `eventType`, `amount`, `currency`, `creemPayload`, `createdAt`, `updatedAt`.

`userId` опционален в Payment — при checkout пользователь может быть не найден.

```js
const formatOptionalId = (value) => {
  if (!value) return null;
  return value.toString();
};

const paymentToDTO = (doc) => ({
  id: doc._id.toString(),
  userId: formatOptionalId(doc.userId),
  creemSubscriptionId: doc.creemSubscriptionId,
  creemEventId: doc.creemEventId,
  productId: doc.productId,
  type: doc.type,
  eventType: doc.eventType,
  amount: doc.amount,
  currency: doc.currency,
  creemPayload: doc.creemPayload,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
```

### authDto.refreshTokenToDTO

Новый DTO для RefreshToken. Входные поля: `_id`, `token`, `userId` (required), `provider`, `providerUserId`, `expiresAt`, `createdAt`, `updatedAt`.

```js
const refreshTokenToDTO = (doc) => ({
  id: doc._id.toString(),
  token: doc.token,
  userId: doc.userId.toString(),
  provider: doc.provider,
  providerUserId: doc.providerUserId,
  expiresAt: doc.expiresAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
```

## Изменения в репозиториях

### userRepository.js

Импортирует `userDto`. Каждый метод оборачивает результат:

```js
import userDto from "../dto/userDto.js";

const createUser = async (data) => {
  const doc = await User.create(data);
  return userDto.toDTO(doc);
};

const getUserById = async (id) => {
  const doc = await User.findById(id);
  if (!doc) return null;
  return userDto.toDTO(doc);
};

const getUser = async (filter = {}) => {
  const doc = await User.findOne(filter);
  if (!doc) return null;
  return userDto.toDTO(doc);
};

const updateUser = async (id, update) => {
  const doc = await User.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return null;
  return userDto.toDTO(doc);
};

const deleteUser = async (id) => {
  const doc = await User.findByIdAndDelete(id);
  if (!doc) return null;
  return userDto.toDTO(doc);
};
```

### subscriptionRepository.js

Импортирует `billingDto`. Все методы оборачивают результат.

Метод `updateStatusByCreemId` — использует `before.toObject()` внутри репозитория для создания синтетического `after` объекта. Это допустимо, т.к. `toObject()` вызывается внутри репозитория (граница Mongoose), а не снаружи. Компромисс: `after` не перечитывается из БД, поэтому middleware/validators Mongoose не отражены. Это приемлемо — текущая реализация уже работает так.

```js
import billingDto from "../dto/billingDto.js";

const upsertByCreemSubscriptionId = async (creemSubscriptionId, data) => {
  const doc = await Subscription.findOneAndUpdate(
    { creemSubscriptionId },
    data,
    { upsert: true, new: true },
  );
  return billingDto.subscriptionToDTO(doc);
};

const getActiveSubscriptionByUserId = async (userId) => {
  const doc = await Subscription.findOne({
    userId,
    status: { $in: ACCESS_GRANTING_STATUSES },
  });
  if (!doc) return null;
  return billingDto.subscriptionToDTO(doc);
};

const getSubscriptionByCreemId = async (creemSubscriptionId) => {
  const doc = await Subscription.findOne({ creemSubscriptionId });
  if (!doc) return null;
  return billingDto.subscriptionToDTO(doc);
};

const updateStatusByCreemId = async (creemSubscriptionId, updateFields) => {
  const before = await Subscription.findOneAndUpdate(
    { creemSubscriptionId },
    updateFields,
    { new: false },
  );
  if (!before) return null;
  const afterDoc = { ...before.toObject(), ...updateFields };
  return {
    before: billingDto.subscriptionToDTO(before),
    after: billingDto.subscriptionToDTO(afterDoc),
  };
};
```

### paymentRepository.js

Импортирует `billingDto`. Все методы оборачивают результат.

Метод `getOneTimePurchasesByUserId` — убрать проекцию `{ productId: 1 }`, чтобы DTO получал все поля. Потребитель (`planServices.js`) использует только `productId`, но DTO не должен содержать `undefined`-поля.

```js
import billingDto from "../dto/billingDto.js";

const createPayment = async (data) => {
  const doc = await Payment.create(data);
  return billingDto.paymentToDTO(doc);
};

const getPaymentsByUserId = async (userId, limit = 50) => {
  const docs = await Payment.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
  return docs.map(billingDto.paymentToDTO);
};

const hasOneTimePurchase = async (userId, productId) => {
  return await Payment.exists({ userId, productId, type: "one_time" });
};

const getOneTimePurchasesByUserId = async (userId) => {
  const docs = await Payment.find({ userId, type: "one_time" });
  return docs.map(billingDto.paymentToDTO);
};
```

Примечание: `hasOneTimePurchase` возвращает boolean-like результат, DTO не нужен.

### refreshTokenRepository.js

Импортирует `authDto`. Методы `getRefreshTokenByToken` и `createRefreshToken` оборачивают результат. Delete-методы возвращают void (операция удаления, результат не используется).

```js
import authDto from "../dto/authDto.js";

const createRefreshToken = async (data) => {
  const doc = await RefreshToken.create(data);
  return authDto.refreshTokenToDTO(doc);
};

const getRefreshTokenByToken = async (token) => {
  const doc = await RefreshToken.findOne({ token });
  if (!doc) return null;
  return authDto.refreshTokenToDTO(doc);
};

const deleteRefreshTokensByUserAndProvider = async (userId, provider) => {
  await RefreshToken.deleteMany({ userId, provider });
};

const deleteRefreshTokenByToken = async (token) => {
  await RefreshToken.deleteOne({ token });
};
```

## Изменения в контроллерах

### userController.js

- Убрать `import userDto from "../dto/userDto.js"`
- Заменить все `userDto.toDTO(user)` → просто `user`

```js
// было
httpResponse(res, generalStatus.SUCCESS, userDto.toDTO(user));

// стало
httpResponse(res, generalStatus.SUCCESS, user);
```

### billingController.js, authController.js

Без изменений — не используют DTO.

## Изменения в сервисах

### authServices.js

Заменить все `user._id` и `existing._id` на `user.id` и `existing.id`. После DTO, `id` — это уже строка, `.toString()` больше не нужен.

Конкретные изменения:

| Строка | Было | Стало |
|--------|------|-------|
| 43 | `userRepository.updateUser(existing._id, ...)` | `userRepository.updateUser(existing.id, ...)` |
| 56 | `id: user._id.toString()` | `id: user.id` |
| 73-74 | `user._id` (deleteRefreshTokens + buildRefreshTokenRecord) | `user.id` |
| 80 | `user._id` (buildRefreshTokenRecord) | `user.id` |

`refreshSession` (строка 100): `stored.userId` и `stored.provider` и `stored.expiresAt` — все эти поля присутствуют в refreshTokenToDTO, работает без изменений.

### billingServices.js

Одно изменение:

| Строка | Было | Стало |
|--------|------|-------|
| 95 | `const userId = user ? user._id : null` | `const userId = user ? user.id : null` |

Остальное — `result.before.userId`, `result.before.status`, `subscription.planKey` — бизнес-поля, присутствуют в DTO. Mongoose `findById` и `create` принимают строки, автокаст работает.

### userServices.js, planServices.js

Без изменений.

## Новые файлы

| Файл | Описание |
|------|----------|
| `src/dto/authDto.js` | DTO для RefreshToken |

## Файлы которые меняются

| Файл | Тип изменения |
|------|---------------|
| `src/dto/userDto.js` | Убрать null-check и toObject, чистый маппинг |
| `src/dto/billingDto.js` | Убрать null-check и toObject, добавить бизнес-поля, убрать optional chaining для required-полей |
| `src/repository/userRepository.js` | Импорт DTO, обёртка каждого метода |
| `src/repository/subscriptionRepository.js` | Импорт DTO, обёртка каждого метода |
| `src/repository/paymentRepository.js` | Импорт DTO, обёртка каждого метода, убрать проекцию в getOneTimePurchasesByUserId |
| `src/repository/refreshTokenRepository.js` | Импорт DTO, обёртка get/create методов |
| `src/controllers/userController.js` | Убрать импорт и вызовы userDto |
| `src/services/authServices.js` | `._id` → `.id`, убрать `.toString()` где id уже строка |
| `src/services/billingServices.js` | `user._id` → `user.id` (строка 95) |

## Файлы которые НЕ меняются

| Файл | Причина |
|------|---------|
| `src/models/*` | Mongoose-схемы без изменений |
| `src/services/userServices.js` | Проксирует репозиторий, DTO уже применён |
| `src/services/planServices.js` | Использует `payment.productId` — бизнес-поле, в DTO |
| `src/controllers/authController.js` | Не использует DTO |
| `src/controllers/billingController.js` | Не использует DTO |

## Миграция `_id` → `id` — чеклист

Поиск по проекту: все обращения к `._id` в сервисах и контроллерах должны быть заменены на `.id`.

```
grep -rn '\._id' src/services/ src/controllers/
```

После замены, `._id` должен остаться только внутри `src/repository/` и `src/models/`.
