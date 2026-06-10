# Org Booking Telegram Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Telegram-уведомления о бронингах должны приходить lead host'у бронинга и всем active owner/admin орги — единое сообщение, дедупликация по userId.

**Architecture:** Заменяем `sendStaffTelegramNotification` (рассылка только lead host'у) на `sendBookingTelegramNotifications` (фан-аут на список получателей с дедупом). Никаких новых моделей или полей. Используем существующее `User.telegramChatId` и `Membership` (роли `owner`/`admin`, статус `active`).

**Tech Stack:** Node.js (ESM), Express 5, Mongoose, grammy (Telegram), node:test + `--experimental-test-module-mocks` (как в `src/modules/billing/__tests__/billing.test.js`).

**Spec:** [docs/superpowers/specs/2026-04-15-org-booking-telegram-notifications-design.md](../specs/2026-04-15-org-booking-telegram-notifications-design.md)

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src/repository/membershipRepository.js` | Modify | Добавить `getOrgAdminUserIds(orgId)` |
| `src/services/notificationServices.js` | Modify | Удалить `sendStaffTelegramNotification`, добавить `collectRecipientUserIds`, `sendBookingTelegramToUser`, `sendBookingTelegramNotifications` |
| `src/services/bookingServices.js` | Modify | Заменить 5 вызовов `sendStaffTelegramNotification` → `sendBookingTelegramNotifications` |
| `src/services/__tests__/notificationServices.test.js` | Create | Юнит-тесты для `collectRecipientUserIds` (дедуп) и `sendBookingTelegramNotifications` (фан-аут с моками) |
| `package.json` | Modify | Добавить test-script для нового тест-файла |

---

## Task 1: Repository helper `getOrgAdminUserIds`

**Files:**
- Modify: `src/repository/membershipRepository.js`

- [ ] **Step 1: Read current state of repository**

Open [src/repository/membershipRepository.js](../../../src/repository/membershipRepository.js) и убедиться: импорт `Membership` и `MEMBERSHIP_STATUS` уже есть в начале файла.

- [ ] **Step 2: Add `getOrgAdminUserIds`**

Перед строкой `export { ... }` (строка ~97) добавить:

```js
// Возвращает userId всех активных owner и admin указанной организации
const getOrgAdminUserIds = async (orgId) => {
  if (!orgId) return [];
  const docs = await Membership.find({
    orgId,
    role: { $in: ["owner", "admin"] },
    status: MEMBERSHIP_STATUS.ACTIVE,
  }).select("userId");
  const toUserId = (doc) => doc.userId;
  return docs.map(toUserId);
};
```

- [ ] **Step 3: Export the new function**

В строке `export { ... }` в конце файла добавить `getOrgAdminUserIds`:

```js
export { getActiveMembership, getActiveMembersByOrg, getActiveAndInvitedMembersByOrg, getMembershipsByUser, createMembership, getActiveMembersByPositions, getActiveMembersByUserIds, countByPositionId, getMemberUserIdsByOrg, getMembershipByUserAndOrg, acceptInvitation, declineInvitation, getOrgAdminUserIds };
```

- [ ] **Step 4: Verify file parses (no syntax errors)**

Run: `node --check src/repository/membershipRepository.js`
Expected: команда завершается без вывода (exit code 0).

- [ ] **Step 5: Commit**

```bash
git add src/repository/membershipRepository.js
git commit -m "feat(membership): добавить getOrgAdminUserIds для рассылки уведомлений"
```

---

## Task 2: Test scaffolding

**Files:**
- Create: `src/services/__tests__/notificationServices.test.js`
- Modify: `package.json`

- [ ] **Step 1: Create test directory**

```bash
mkdir -p src/services/__tests__
```

- [ ] **Step 2: Add a stub failing test**

Создать `src/services/__tests__/notificationServices.test.js` со следующим содержимым:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("notificationServices", () => {
  it("placeholder — to be replaced in Task 3", () => {
    assert.equal(true, false);
  });
});
```

- [ ] **Step 3: Add npm script**

В `package.json`, в секцию `"scripts"` добавить:

```json
"test:notifications": "node --experimental-test-module-mocks --test src/services/__tests__/notificationServices.test.js"
```

Файл должен выглядеть так в части scripts:

```json
"scripts": {
  "dev": "nodemon --env-file=.env src/app.js",
  "seed": "node src/scripts/seed.js",
  "test": "node --experimental-test-module-mocks --test src/modules/billing/__tests__/billing.test.js",
  "test:billing": "node --experimental-test-module-mocks --test src/modules/billing/__tests__/billing.test.js",
  "test:notifications": "node --experimental-test-module-mocks --test src/services/__tests__/notificationServices.test.js"
}
```

- [ ] **Step 4: Run test, verify it fails**

Run: `npm run test:notifications`
Expected: тест падает (`AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: true !== false`).

- [ ] **Step 5: Commit scaffolding**

```bash
git add src/services/__tests__/notificationServices.test.js package.json
git commit -m "test(notifications): добавить scaffold для тестов notificationServices"
```

---

## Task 3: TDD `collectRecipientUserIds` (дедупликация)

**Files:**
- Modify: `src/services/__tests__/notificationServices.test.js`
- Modify: `src/services/notificationServices.js` (новая функция, существующая `sendStaffTelegramNotification` пока остаётся)

- [ ] **Step 1: Replace the placeholder test with real specs**

Перезаписать `src/services/__tests__/notificationServices.test.js`:

```js
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

const membershipRepoPath = "../../repository/membershipRepository.js";

describe("collectRecipientUserIds", () => {
  let collectRecipientUserIds;
  let membershipMock;

  beforeEach(async () => {
    membershipMock = mock.module(membershipRepoPath, {
      namedExports: {
        getOrgAdminUserIds: async () => [],
      },
    });
    ({ collectRecipientUserIds } = await import("../notificationServices.js"));
  });

  afterEach(() => {
    membershipMock.restore();
    mock.reset();
  });

  it("returns only lead host when org has no admins", async () => {
    membershipMock.restore();
    membershipMock = mock.module(membershipRepoPath, {
      namedExports: { getOrgAdminUserIds: async () => [] },
    });
    ({ collectRecipientUserIds } = await import("../notificationServices.js"));

    const booking = {
      orgId: "org1",
      hosts: [{ userId: "u-lead", role: "lead" }],
    };
    const result = await collectRecipientUserIds(booking);
    assert.deepEqual(result.map(String), ["u-lead"]);
  });

  it("returns lead host + admins (no overlap)", async () => {
    membershipMock.restore();
    membershipMock = mock.module(membershipRepoPath, {
      namedExports: { getOrgAdminUserIds: async () => ["u-owner", "u-admin"] },
    });
    ({ collectRecipientUserIds } = await import("../notificationServices.js"));

    const booking = {
      orgId: "org1",
      hosts: [{ userId: "u-lead", role: "lead" }],
    };
    const result = await collectRecipientUserIds(booking);
    assert.deepEqual(result.map(String).sort(), ["u-admin", "u-lead", "u-owner"]);
  });

  it("dedupes when lead host is also owner of the org", async () => {
    membershipMock.restore();
    membershipMock = mock.module(membershipRepoPath, {
      namedExports: { getOrgAdminUserIds: async () => ["u-lead", "u-admin"] },
    });
    ({ collectRecipientUserIds } = await import("../notificationServices.js"));

    const booking = {
      orgId: "org1",
      hosts: [{ userId: "u-lead", role: "lead" }],
    };
    const result = await collectRecipientUserIds(booking);
    assert.deepEqual(result.map(String).sort(), ["u-admin", "u-lead"]);
  });

  it("returns admins only when no lead host exists", async () => {
    membershipMock.restore();
    membershipMock = mock.module(membershipRepoPath, {
      namedExports: { getOrgAdminUserIds: async () => ["u-admin"] },
    });
    ({ collectRecipientUserIds } = await import("../notificationServices.js"));

    const booking = { orgId: "org1", hosts: [] };
    const result = await collectRecipientUserIds(booking);
    assert.deepEqual(result.map(String), ["u-admin"]);
  });
});
```

- [ ] **Step 2: Run test, verify it fails (function not exported)**

Run: `npm run test:notifications`
Expected: падает с `TypeError: collectRecipientUserIds is not a function` или подобным (функция ещё не существует).

- [ ] **Step 3: Implement `collectRecipientUserIds` and export it**

В [src/services/notificationServices.js](../../../src/services/notificationServices.js):

a) Добавить импорт в начало файла рядом с другими импортами:

```js
import { getOrgAdminUserIds } from "../repository/membershipRepository.js";
```

b) Перед `sendStaffTelegramNotification` добавить:

```js
const sameId = (target) => (id) => String(id) === String(target);

const dedupeIds = (ids) => {
  const reducer = (acc, id) => (acc.some(sameId(id)) ? acc : [...acc, id]);
  return ids.reduce(reducer, []);
};

const collectRecipientUserIds = async (booking) => {
  const leadHost = findLeadHost(booking);
  const adminIds = await getOrgAdminUserIds(booking.orgId);
  const all = leadHost ? [leadHost.userId, ...adminIds] : adminIds;
  return dedupeIds(all);
};
```

c) В `export { ... }` (последняя строка файла) добавить `collectRecipientUserIds`:

```js
export { createBookingNotifications, skipNotifications, sendStaffTelegramNotification, collectRecipientUserIds };
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test:notifications`
Expected: 4/4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/notificationServices.js src/services/__tests__/notificationServices.test.js
git commit -m "feat(notifications): collectRecipientUserIds с дедупом lead host + admin'ов орги"
```

---

## Task 4: TDD `sendBookingTelegramToUser`

**Files:**
- Modify: `src/services/__tests__/notificationServices.test.js`
- Modify: `src/services/notificationServices.js`

- [ ] **Step 1: Append test block to the test file**

В конец `src/services/__tests__/notificationServices.test.js` добавить:

```js
describe("sendBookingTelegramToUser", () => {
  let sendBookingTelegramToUser;
  let telegramMock;
  let notificationRepoMock;

  const setupMocks = async ({ sendMessageImpl }) => {
    telegramMock = mock.module("../../providers/telegramProvider.js", {
      namedExports: {
        sendMessage: sendMessageImpl,
        initBot: () => {},
        getBot: () => null,
      },
    });
    notificationRepoMock = mock.module("../../repository/notificationRepository.js", {
      namedExports: {
        createNotification: async (data) => ({ _id: "n1", ...data }),
        createManyNotifications: async () => [],
        skipScheduledByBooking: async () => [],
      },
    });
    mock.module("../../repository/membershipRepository.js", {
      namedExports: { getOrgAdminUserIds: async () => [] },
    });
    ({ sendBookingTelegramToUser } = await import("../notificationServices.js"));
  };

  afterEach(() => {
    mock.reset();
  });

  it("creates SENT notification when sendMessage returns id", async () => {
    const calls = [];
    await setupMocks({
      sendMessageImpl: async (chatId, text) => {
        calls.push({ chatId, text });
        return "msg-42";
      },
    });

    const booking = { _id: "b1", orgId: "o1", startAt: new Date("2026-04-20T10:00:00Z"), hosts: [], inviteeSnapshot: {} };
    const user = { _id: "u1", name: "Alice", telegramChatId: "chat-1" };
    const result = await sendBookingTelegramToUser(booking, "booking_confirmed", user, "Bob");

    assert.equal(calls.length, 1);
    assert.equal(calls[0].chatId, "chat-1");
    assert.equal(result.status, "sent");
    assert.equal(result.externalId, "msg-42");
    assert.equal(String(result.recipientId), "u1");
  });

  it("creates SKIPPED notification when sendMessage returns null", async () => {
    await setupMocks({ sendMessageImpl: async () => null });

    const booking = { _id: "b1", orgId: "o1", startAt: new Date(), hosts: [], inviteeSnapshot: {} };
    const user = { _id: "u1", name: "Alice", telegramChatId: "chat-1" };
    const result = await sendBookingTelegramToUser(booking, "booking_confirmed", user, "Bob");

    assert.equal(result.status, "skipped");
  });

  it("creates FAILED notification when sendMessage throws", async () => {
    await setupMocks({
      sendMessageImpl: async () => {
        throw new Error("network down");
      },
    });

    const booking = { _id: "b1", orgId: "o1", startAt: new Date(), hosts: [], inviteeSnapshot: {} };
    const user = { _id: "u1", name: "Alice", telegramChatId: "chat-1" };
    const result = await sendBookingTelegramToUser(booking, "booking_confirmed", user, "Bob");

    assert.equal(result.status, "failed");
    assert.equal(result.attempts, 1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails (function missing)**

Run: `npm run test:notifications`
Expected: новые 3 теста падают с `TypeError: sendBookingTelegramToUser is not a function`.

- [ ] **Step 3: Implement `sendBookingTelegramToUser`**

В `src/services/notificationServices.js` перед `sendStaffTelegramNotification` добавить:

```js
const sendBookingTelegramToUser = async (booking, type, user, staffName) => {
  const text = formatNotificationMessage(type, booking, staffName);
  const notificationData = {
    bookingId: booking._id,
    recipientId: user._id,
    recipientType: "staff",
    channel: NOTIFICATION_CHANNEL.TELEGRAM,
    type,
    scheduledAt: new Date(),
  };

  if (!text) {
    console.warn(`No Telegram template for notification type: ${type}`);
    return createNotification({ ...notificationData, status: NOTIFICATION_STATUS.SKIPPED });
  }

  try {
    const externalId = await sendMessage(user.telegramChatId, text);
    if (!externalId) {
      return createNotification({ ...notificationData, status: NOTIFICATION_STATUS.SKIPPED });
    }
    return createNotification({
      ...notificationData,
      status: NOTIFICATION_STATUS.SENT,
      externalId,
    });
  } catch (error) {
    console.error("Telegram notification failed:", error.message);
    return createNotification({
      ...notificationData,
      status: NOTIFICATION_STATUS.FAILED,
      attempts: 1,
    });
  }
};
```

В `export { ... }` добавить `sendBookingTelegramToUser`:

```js
export { createBookingNotifications, skipNotifications, sendStaffTelegramNotification, collectRecipientUserIds, sendBookingTelegramToUser };
```

- [ ] **Step 4: Run test, verify all pass**

Run: `npm run test:notifications`
Expected: 7/7 tests pass (4 из Task 3 + 3 новых).

- [ ] **Step 5: Commit**

```bash
git add src/services/notificationServices.js src/services/__tests__/notificationServices.test.js
git commit -m "feat(notifications): sendBookingTelegramToUser — отправка одному получателю"
```

---

## Task 5: TDD `sendBookingTelegramNotifications` (фан-аут)

**Files:**
- Modify: `src/services/__tests__/notificationServices.test.js`
- Modify: `src/services/notificationServices.js`

- [ ] **Step 1: Append fan-out tests**

В конец `src/services/__tests__/notificationServices.test.js` добавить:

```js
describe("sendBookingTelegramNotifications", () => {
  let sendBookingTelegramNotifications;
  let sentMessages;

  const setup = async ({ adminIds, users }) => {
    sentMessages = [];
    mock.module("../../providers/telegramProvider.js", {
      namedExports: {
        sendMessage: async (chatId, text) => {
          sentMessages.push({ chatId, text });
          return `msg-${chatId}`;
        },
        initBot: () => {},
        getBot: () => null,
      },
    });
    mock.module("../../repository/notificationRepository.js", {
      namedExports: {
        createNotification: async (data) => ({ _id: "n", ...data }),
        createManyNotifications: async () => [],
        skipScheduledByBooking: async () => [],
      },
    });
    mock.module("../../repository/membershipRepository.js", {
      namedExports: { getOrgAdminUserIds: async () => adminIds },
    });
    mock.module("../../modules/user/model/User.js", {
      defaultExport: {
        find: async (query) => {
          const ids = query._id.$in.map(String);
          return users.filter((u) => ids.includes(String(u._id)) && u.telegramChatId);
        },
        findById: async (id) => users.find((u) => String(u._id) === String(id)) || null,
      },
    });
    ({ sendBookingTelegramNotifications } = await import("../notificationServices.js"));
  };

  afterEach(() => {
    mock.reset();
  });

  it("sends to lead host + admins, deduped", async () => {
    await setup({
      adminIds: ["u-owner", "u-admin"],
      users: [
        { _id: "u-lead",  name: "Lead",  telegramChatId: "chat-lead" },
        { _id: "u-owner", name: "Owner", telegramChatId: "chat-owner" },
        { _id: "u-admin", name: "Admin", telegramChatId: "chat-admin" },
      ],
    });

    const booking = {
      _id: "b1", orgId: "o1", startAt: new Date(),
      hosts: [{ userId: "u-lead", role: "lead" }],
      inviteeSnapshot: {},
    };

    await sendBookingTelegramNotifications(booking, "booking_confirmed");

    const chats = sentMessages.map((m) => m.chatId).sort();
    assert.deepEqual(chats, ["chat-admin", "chat-lead", "chat-owner"]);
  });

  it("skips users without telegramChatId", async () => {
    await setup({
      adminIds: ["u-owner"],
      users: [
        { _id: "u-lead",  name: "Lead",  telegramChatId: "chat-lead" },
        { _id: "u-owner", name: "Owner", telegramChatId: null },
      ],
    });

    const booking = {
      _id: "b1", orgId: "o1", startAt: new Date(),
      hosts: [{ userId: "u-lead", role: "lead" }],
      inviteeSnapshot: {},
    };

    await sendBookingTelegramNotifications(booking, "booking_confirmed");

    assert.deepEqual(sentMessages.map((m) => m.chatId), ["chat-lead"]);
  });

  it("does nothing when no recipients have telegramChatId", async () => {
    await setup({
      adminIds: [],
      users: [{ _id: "u-lead", name: "Lead", telegramChatId: null }],
    });

    const booking = {
      _id: "b1", orgId: "o1", startAt: new Date(),
      hosts: [{ userId: "u-lead", role: "lead" }],
      inviteeSnapshot: {},
    };

    const result = await sendBookingTelegramNotifications(booking, "booking_confirmed");

    assert.deepEqual(sentMessages, []);
    assert.deepEqual(result, []);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test:notifications`
Expected: новые 3 теста падают с `TypeError: sendBookingTelegramNotifications is not a function`.

- [ ] **Step 3: Implement `sendBookingTelegramNotifications`**

В `src/services/notificationServices.js`:

a) Перед `sendStaffTelegramNotification` добавить:

```js
const resolveStaffName = async (booking) => {
  const leadHost = findLeadHost(booking);
  if (!leadHost) return null;
  const user = await User.findById(leadHost.userId);
  return user ? user.name : null;
};

const hasTelegram = (user) => !!user.telegramChatId;

const sendBookingTelegramNotifications = async (booking, type) => {
  const userIds = await collectRecipientUserIds(booking);
  if (userIds.length === 0) return [];

  const users = await User.find({
    _id: { $in: userIds },
    telegramChatId: { $ne: null },
  });
  const reachable = users.filter(hasTelegram);
  if (reachable.length === 0) return [];

  const staffName = await resolveStaffName(booking);
  const sendOne = (user) => sendBookingTelegramToUser(booking, type, user, staffName);
  return Promise.all(reachable.map(sendOne));
};
```

b) В `export { ... }` добавить `sendBookingTelegramNotifications`:

```js
export { createBookingNotifications, skipNotifications, sendStaffTelegramNotification, collectRecipientUserIds, sendBookingTelegramToUser, sendBookingTelegramNotifications };
```

- [ ] **Step 4: Run test, verify all pass**

Run: `npm run test:notifications`
Expected: 10/10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/notificationServices.js src/services/__tests__/notificationServices.test.js
git commit -m "feat(notifications): sendBookingTelegramNotifications — фан-аут с дедупом"
```

---

## Task 6: Переключить `bookingServices.js` на новую функцию

**Files:**
- Modify: `src/services/bookingServices.js`

- [ ] **Step 1: Inspect current call sites**

Run: `grep -n sendStaffTelegramNotification src/services/bookingServices.js`
Expected: 6 строк (1 импорт + 5 вызовов) — строки 20, 89, 106, 118, 147, 175 (могут немного отличаться).

- [ ] **Step 2: Replace import**

В `src/services/bookingServices.js` найти строку:

```js
  sendStaffTelegramNotification,
```

в импорте из `./notificationServices.js` и заменить на:

```js
  sendBookingTelegramNotifications,
```

- [ ] **Step 3: Replace all 5 call sites**

Заменить во всём файле `sendStaffTelegramNotification(` → `sendBookingTelegramNotifications(`. Сигнатура та же (`booking, type`), поведение для lead host'а сохраняется + добавляются owner/admin.

Команда для проверки:

Run: `grep -n sendStaffTelegramNotification src/services/bookingServices.js`
Expected: пусто.

Run: `grep -n sendBookingTelegramNotifications src/services/bookingServices.js`
Expected: 6 строк (1 импорт + 5 вызовов).

- [ ] **Step 4: Verify file parses**

Run: `node --check src/services/bookingServices.js`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/services/bookingServices.js
git commit -m "refactor(bookings): использовать sendBookingTelegramNotifications вместо sendStaffTelegramNotification"
```

---

## Task 7: Удалить устаревшую `sendStaffTelegramNotification`

**Files:**
- Modify: `src/services/notificationServices.js`
- Modify: `src/services/__tests__/notificationServices.test.js`

- [ ] **Step 1: Confirm no remaining callers**

Run: `grep -rn sendStaffTelegramNotification src/`
Expected: только определение в `src/services/notificationServices.js` и упоминание в `src/services/__tests__/notificationServices.test.js` (если есть). Никаких callers в коде.

- [ ] **Step 2: Delete the function**

В `src/services/notificationServices.js` удалить весь блок `const sendStaffTelegramNotification = async (booking, type) => { ... }` (строки ~79-122 в исходном файле).

- [ ] **Step 3: Remove from export list**

В строке `export { ... }` убрать `sendStaffTelegramNotification`. Финальный экспорт:

```js
export { createBookingNotifications, skipNotifications, collectRecipientUserIds, sendBookingTelegramToUser, sendBookingTelegramNotifications };
```

- [ ] **Step 4: Run all notification tests**

Run: `npm run test:notifications`
Expected: 10/10 tests pass.

- [ ] **Step 5: Run billing tests to confirm no regression**

Run: `npm run test:billing`
Expected: тесты проходят (если они и раньше проходили на `main`).

- [ ] **Step 6: Smoke-import the booking service**

Run: `node --check src/services/bookingServices.js && node --check src/services/notificationServices.js`
Expected: оба exit code 0.

- [ ] **Step 7: Commit**

```bash
git add src/services/notificationServices.js
git commit -m "chore(notifications): удалить устаревший sendStaffTelegramNotification"
```

---

## Task 8: Manual verification

**Files:** none — ручная проверка.

- [ ] **Step 1: Boot the app**

Run: `npm run dev`
Expected: сервер стартует без ошибок, в логах `Telegram bot started (polling)` (если `TELEGRAM_BOT_TOKEN` задан).

- [ ] **Step 2: Create a booking via API**

Через фронт или curl создать бронинг в орге, где:
- lead host = User A (с привязанным `telegramChatId`),
- owner орги = User B (с привязанным `telegramChatId`),
- admin орги = User C (без `telegramChatId`).

Expected результат:
- User A получает Telegram-сообщение `✅ Новий запис ...`.
- User B получает то же Telegram-сообщение.
- User C — ничего (нет привязки).
- В БД создаются 2 `Notification` записи со `status = "sent"`, `channel = "telegram"`.

- [ ] **Step 3: Stop the app**

Ctrl+C в терминале с `npm run dev`.

---

## Done Criteria

- `npm run test:notifications` → 10/10 pass.
- `npm run test:billing` → как было до изменений (без новых регрессий).
- `grep -rn sendStaffTelegramNotification src/` → пусто.
- Ручная проверка: при создании бронинга в орге сообщение получают lead host + все active owner/admin с привязанным Telegram, дедуплицированно.
