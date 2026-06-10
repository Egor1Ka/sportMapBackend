# Org Booking Telegram Notifications

## Problem

Telegram-уведомления о бронингах сейчас уходят только **lead host** бронинга
(см. `sendStaffTelegramNotification` в [src/services/notificationServices.js](../../../src/services/notificationServices.js)).
Owner и admin'ы организации, которым важно видеть активность по орге целиком,
не получают уведомлений в Telegram.

## Goal

При событии бронинга в орге слать одно и то же Telegram-сообщение всем
причастным пользователям, у которых привязан личный Telegram:

- **Lead host** бронинга (тот, кому записались).
- Все **owner** и **admin** этой орги (`Membership.role ∈ {owner, admin}`,
  `status = "active"`).

Получатели дедуплицируются по `userId` — один и тот же человек получает
сообщение один раз, даже если он одновременно lead host и owner орги.

## Non-Goals

- Никаких новых полей на `Organization` (никакого `telegramChatId` на орге).
- Никакого кастомного бот-токена per-org — используется глобальный
  `TELEGRAM_BOT_TOKEN`.
- Никакого нового UI — Telegram уже привязывается в личном профиле.
- Не меняем расписание/структуру фоновых notification-задач.

## Design

### 1. Новый репозиторный хелпер

В [src/repository/membershipRepository.js](../../../src/repository/membershipRepository.js)
добавить:

```js
const getOrgAdminUserIds = async (orgId) => {
  const docs = await Membership.find({
    orgId,
    role: { $in: ["owner", "admin"] },
    status: MEMBERSHIP_STATUS.ACTIVE,
  }).select("userId");
  const toUserId = (doc) => doc.userId;
  return docs.map(toUserId);
};
```

Экспортируется из модуля наряду с остальными.

### 2. Замена `sendStaffTelegramNotification` → `sendBookingTelegramNotifications`

Файл: [src/services/notificationServices.js](../../../src/services/notificationServices.js).

Удаляем `sendStaffTelegramNotification`. Добавляем:

```js
const collectRecipientUserIds = async (booking) => {
  const leadHost = findLeadHost(booking);
  const adminIds = await getOrgAdminUserIds(booking.orgId);
  const all = leadHost ? [leadHost.userId, ...adminIds] : adminIds;
  const dedupe = (acc, id) => (acc.some(eq(id)) ? acc : [...acc, id]);
  return all.reduce(dedupe, []);
};

const sendBookingTelegramNotifications = async (booking, type) => {
  const userIds = await collectRecipientUserIds(booking);
  const users   = await User.find({
    _id: { $in: userIds },
    telegramChatId: { $ne: null },
  });
  const sendOne = (user) => sendBookingTelegramToUser(booking, type, user);
  return Promise.all(users.map(sendOne));
};
```

`sendBookingTelegramToUser(booking, type, user)` — единая функция,
которая делает то же что текущая `sendStaffTelegramNotification`, но
для произвольного пользователя:
- форматирует сообщение через `formatNotificationMessage(type, booking, user.name)`,
- зовёт `sendMessage(user.telegramChatId, text)`,
- создаёт `Notification` запись со `status` SENT/SKIPPED/FAILED и
  `recipientId = user._id`, `recipientType = "staff"`,
  `channel = NOTIFICATION_CHANNEL.TELEGRAM`.

`eq` — `(target) => (id) => String(id) === String(target)` — корректное сравнение
ObjectId через приведение к строке.

### 3. Замена сообщения

В [src/services/telegramMessageFormatter.js](../../../src/services/telegramMessageFormatter.js)
**ничего не меняем**. Сообщение единое для всех получателей. Получатель и
так понимает «откуда» уведомление по полю `staffName` (передаётся имя lead host'а).

> **Решение:** имя получателя (`user.name`) не подставляем в шаблон — это сломало
> бы значение `👨‍💼 staffName` (текущая семантика — это исполнитель бронинга).
> Вместо этого передаём имя lead host'а через все вызовы.

Сигнатура `sendBookingTelegramToUser` принимает `staffName` отдельным аргументом:

```js
sendBookingTelegramToUser(booking, type, user, staffName)
```

`staffName` вычисляется один раз в `sendBookingTelegramNotifications` через
`User.findById(leadHost.userId).name` (или `null` если lead host'а нет).

### 4. Перевод вызовов

Найти в кодовой базе все `sendStaffTelegramNotification(booking, type)` и
заменить на `sendBookingTelegramNotifications(booking, type)`. Сигнатура и
поведение для lead-host'а сохраняются (он по-прежнему получает сообщение),
плюс добавляются owner/admin.

## Edge Cases

- **Lead host = owner орги** — дедупликация по `userId`, шлём один раз.
- **Нет lead host** в `booking.hosts` — шлём только owner/admin.
- **Никто из получателей не привязал Telegram** — `users` пустой,
  `Promise.all([])` возвращает `[]`, ошибок нет, `Notification` записи
  не создаются.
- **`sendMessage` упал у одного из получателей** — `try/catch` внутри
  `sendBookingTelegramToUser` пишет `Notification` со `status = FAILED` для
  этого юзера, остальные получают сообщение нормально.
- **Бронинг без orgId** — `getOrgAdminUserIds(undefined)` вернёт `[]`,
  слать только lead host'у.

## Testing

Unit (тесты `collectRecipientUserIds`, мок `getOrgAdminUserIds`):

- Lead host есть, admin'ов нет → 1 получатель.
- Lead host есть, admin'ов 2 → 3 получателя.
- Lead host = owner орги → 1 получатель (дедуп).
- Нет lead host'а → только admin'ы.

Интеграция (`sendBookingTelegramNotifications` с моком `sendMessage`):

- Все привязали Telegram → `sendMessage` вызвана N раз, N `Notification` SENT.
- Часть привязала, часть нет → `sendMessage` только для привязавших,
  `Notification` создаются только для них.
- `sendMessage` выбрасывает у одного → у него `Notification` FAILED,
  у остальных SENT.

## File Touch List

- [src/repository/membershipRepository.js](../../../src/repository/membershipRepository.js) — добавить `getOrgAdminUserIds`.
- [src/services/notificationServices.js](../../../src/services/notificationServices.js) — удалить `sendStaffTelegramNotification`, добавить `sendBookingTelegramNotifications` + `sendBookingTelegramToUser` + `collectRecipientUserIds`.
- Все вызывающие модули (поиск по `sendStaffTelegramNotification`) — переключить на новое имя.
- Тесты (новый файл `tests/services/notificationServices.test.js` или существующий).
