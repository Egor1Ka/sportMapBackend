# Timezone correctness across booking system

## Problem

Аудит показал, что tz-модель («храним UTC, интерпретируем HH:MM в tz шаблона расписания») протекает на четырёх уровнях. Симптомы у пользователя: сохраняешь расписание «08:00–18:00 Kyiv», по факту оно сохраняется как 08:00–18:00 UTC; клиент бронирует слот — он не блокируется; после DST или при смене tz браузера карточки броней смещаются; пограничные дни недели ломаются при несовпадении tz сервера и шаблона.

Часть уже починена (коммиты `55cf737`, `c787ef2`, `c787ef2`): `getNowMin` теперь учитывает запрошенную дату, `createBooking`/`rescheduleBookingById` парсят `startAt` в tz шаблона. Оставшиеся проблемы — этот спек.

## Goal

Одна канонич­ная модель:

- **Schedule template** владеет tz. Хранит IANA-строку (например, `Europe/Kyiv`). Все `HH:MM` в `weeklyHours` и override-слотах интерпретируются в ней.
- **UTC — единственное хранимое время для событий** (`startAt`, `endAt`).
- **Tz клиента** никогда не диктует бизнес-логику. Клиент может быть в Берлине и смотреть расписание Kyiv-специалиста — слот «08:00» остаётся 08:00 Kyiv.
- **Поле `booking.timezone`** — только для отображения в письмах/telegram приглашённому, не для вычислений.
- **Server tz не влияет ни на что**. Код не должен читать `.getDate()`/`.getDay()`/`.setHours()` без явно указанной tz.

## Scope

Спек покрывает backend (`BackendTemplate`) и frontend (`Slotix-fronted`). Разбит на 4 блока:

1. Schedule save path (tz попадает в БД корректно).
2. Slot computation (движок работает в tz шаблона, независимо от tz сервера).
3. Booking fetch/display (окна дат и карточки в tz шаблона).
4. Notifications / вторичные места.

Не покрывает: cron-воркер для reminder (отсутствует — отдельная задача), миграцию уже «битых» записей в БД.

## Design

### Block 1 — Schedule save path

**B1.1** `src/services/scheduleServices.js:63` `rotateTemplate`: fallback `timezone || "UTC"` → `timezone || DEFAULT_TIMEZONE`. Если `timezone` — пустая строка — считать невалидной и возвращать `{ error: "timezone_required" }`.

**B1.2** Валидация IANA tz на уровне контроллера перед вызовом `rotateTemplate`: `Intl.supportedValuesOf('timeZone').includes(tz)`. Невалидная строка — 400. Расширяется и на `createDefaultSchedule` (не принимает tz снаружи, валидация на константе DEFAULT_TIMEZONE на уровне unit-test).

**B1.3** Frontend `components/staff-schedule/ScheduleViewTab.tsx` при сохранении:

- Отправляет `timezone` в payload. Источник: текущее `template.timezone` если уже есть; иначе — `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- UI-элемент: compact-переключатель в шапке таба («Часовой пояс: Europe/Kyiv — змінити»). Изменение tz открывает комбобокс со списком IANA tz (react-select + static list из `Intl.supportedValuesOf('timeZone')`).
- При первом открытии редактора без saved-template показывает текущую браузерную tz с явной подсказкой «Время указано в: Europe/Kyiv (ваш браузер). Смените, если вы в другой тайм-зоне.»

### Block 2 — Slot computation

**B2.1** `src/services/slotServices.js:55-66` `getDateRange`: парсить `YYYY-MM-DD` как строку, не через `new Date(...).getFullYear()`. Использовать `Intl.DateTimeFormat('en-CA', {timeZone}).formatToParts` или ручной парсинг (`year, month, day` из split). Далее собирать boundary через Date.UTC и корректно смещать на tz-offset шаблона.

**B2.2** `src/services/slotServices.js:84-85` `dayOfWeek`: убрать `new Date(date).getDay()`. Вычислять weekday детерминированно для пары (`YYYY-MM-DD`, `timezone`):

```
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone })
  .format(new Date(`${date}T12:00:00Z`)).toLowerCase()
```

(берём 12:00 UTC чтобы уйти от полуночных edge-case для любых tz от -12 до +14).

**B2.3** `src/services/slotServices.js:17-22` `toBookingSlot` + `findByStaffAndDate`: для броней через полночь (startAt в день X, endAt в день X+1) добавить второй виртуальный блок в сетке следующего дня. Два варианта:

- a) Расширить `findByStaffAndDate` чтобы возвращала брони чей `[startAt, endAt]` пересекается с `[dateStart, dateEnd]`, а не только `startAt` внутри окна.
- b) В `toBookingSlot` обрезать часть брони которая попадает в запрошенный день.

Выбираем (a) как проще: `endAt > dateStart AND startAt < dateEnd`.

Дополнительно в `toBookingSlot` для брони, начавшейся в предыдущие сутки: `startMin = 0`, `duration = (endAt - dateStart) / 60000`. Для брони, закончившейся в следующие: стандартный `startMin`, `duration = (dateEnd - startAt) / 60000`.

### Block 3 — Booking fetch/display

**B3.1** `src/controllers/bookingController.js:78-84` `handleGetBookingsByStaff`: вместо `new Date(dateFrom) + setHours(23,59,59)` — принять query-параметр `timezone` (обязательный) и парсить boundaries как wall-clock в этой tz (используя `parseWallClockToUtc`). На бэке — валидация IANA. Фронт всегда шлёт tz шаблона который он рендерит.

**B3.2** Frontend `lib/calendar/hooks/useBookingActions.ts` и `useOrgSchedules.ts` — при запросе броней шлют `timezone` = `schedule.timezone` из активного template (не `Intl.DateTimeFormat().resolvedOptions().timeZone`).

**B3.3** Frontend `lib/booking-utils.ts:11-26` `timeToMinFromISO(iso, timezone)` — на вход получать **tz шаблона** (а не `booking.timezone` клиента). Переход: `toCalendarBlock` и все caller'ы передают `schedule.timezone` вместо `booking.timezone`.

**B3.4** Frontend `lib/calendar/utils.ts:119,146,170,237` `new Date(dateStr).getDay()` заменить на helper `getDayOfWeekInTz(dateStr, timezone)` по формуле B2.2.

**B3.5** Frontend `lib/calendar/CalendarCore.tsx:509` `new Date(dayDate + 'T00:00:00').getDay()` — та же замена.

**B3.6** Frontend `components/booking/StaffSlotCard.tsx:32` `today.setHours(0,0,0,0)` — брать «сегодня» в tz расписания: `Intl.DateTimeFormat('en-CA', {timeZone: schedule.timezone}).format(new Date())`.

**B3.7** `app/[locale]/book/[staffSlug]/BookingPage.tsx:72` и `components/booking/OrgCalendarPage.tsx:56` — убрать `DEFAULT_SCHEDULE.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone`. Если template не загружен — показывать спиннер/пустое состояние, не рендерить сетку с браузерной tz. Это защищает от сохранения мусорной tz через rotate.

### Block 4 — Notifications / misc

**B4.1** `src/services/telegramMessageFormatter.js:15` fallback `timezone || "Europe/Kyiv"` → получать tz из template ведущего хоста (`booking.hosts[0].userId` → active template → tz). Если booking.timezone есть и валиден — использовать для отображения invitee. Для host-сообщений — всегда template tz.

**B4.2** `src/services/notificationServices.js:148` — вместо `org.settings.defaultTimezone` брать tz активного template lead-хоста.

**B4.3** `src/services/bookingServices.js:75` — валидировать invitee `timezone` через `Intl.supportedValuesOf('timeZone')`. Невалидный → игнорировать (сохранить null или template tz).

**B4.4** `src/shared/utils/timezone.js:2-6` `getTimezoneOffsetMin` — заменить реализацию на `Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(date)` и вытащить offset из части `timeZoneName` («GMT+3»). Единый helper, без хрупкого parse.

**B4.5** `src/models/ScheduleOverride.js` — добавить js-doc комментарий «Override slots интерпретируются в tz текущего шаблона. Если tz шаблона меняется — интерпретация меняется». Поле `timezone` на override не вводим.

### Block 5 — Оставшиеся tz-протечки (аудит 2026-04-15)

После частичной реализации B1–B4 повторный grep-аудит показал, что browser/server tz всё ещё протекает в ~15 местах фронта и 2 местах бэка. Симптом, приведший к этому блоку: после успешного бронирования правая панель `ConfirmedState` показывает UTC-время (06:00) вместо Kyiv-времени (09:00).

**Frontend (Slotix-fronted):**

**B5.1** `components/booking/BookingPanelParts.tsx:10-15` `formatLocalTime(iso)` использует `getUTCHours/UTCMinutes` — игнорирует любую tz. Переписать на `formatLocalTime(iso, timezone)` через `Intl.DateTimeFormat('en-GB', {timeZone, hour: '2-digit', minute: '2-digit', hour12: false})`. Call-site `ConfirmedState` получает `confirmedBooking.timezone` (схема уже имеет поле — это схема возврата `createBooking`).

**B5.2** `lib/booking-utils.ts:11-26` `timeToMinFromISO(iso, timezone?)` — убрать `if (!timezone) return getUTCHours()...`. Сделать `timezone` обязательным. Все call-site уже передают tz после B3.3.

**B5.3** `lib/calendar/utils.ts:110-116` `getNowMinForDate(dateStr)` — принять `timezone` вторым параметром, вычислять «текущая минута в tz» через `Intl.DateTimeFormat({timeZone, hour: '2-digit', minute: '2-digit'})`. Аналогично `lib/calendar/CalendarCore.tsx:107`.

**B5.4** `lib/calendar/utils.ts` — `formatDateISO` (L98), `formatDateLocale` (L118-126), `formatWeekRange` (L128-135), `formatMonth` (L137-140), `getWeekStart` (L150-157), `getMonthGrid` (L172-198), `addDays` (L200-204), `addMonths` (L206-210). Все парсят `new Date(dateStr + 'T00:00:00')` (browser tz) и используют `getDate/getMonth/setDate`. Переписать на **строковую арифметику YYYY-MM-DD**:
- `formatDateISO(d: Date)` заменить на функцию, принимающую `{year, month, day}` (не Date) — все вызовы обновить.
- Для `addDays/addMonths/getMonthGrid` использовать `Date.UTC(y,m,d)` + `getUTCDate()` — это детерминировано.
- Для `getWeekStart` использовать `getDayOfWeekInTz` (уже существует в `lib/calendar/tz.ts`).

**B5.5** `lib/calendar/CalendarCore.tsx:657` `new Date(cellDate + 'T00:00:00').getDate()` → `parseInt(cellDate.split('-')[2], 10)`.

**B5.6** `components/booking/BookingDetailsPanel.tsx:73, 79` `toLocaleTimeString([], ...)` / `toLocaleDateString([], ...)` — добавить `timeZone: schedule.timezone` в options. Проп `scheduleTimezone` прокинуть из родителя.

**B5.7** `components/booking/BookingDetailPanel.tsx:92` `d.toLocaleDateString(undefined, ...)` — то же.

**B5.8** `components/staff-schedule/BookingListItem.tsx:27`, `BookingDateGroup.tsx:13`, `OverrideListItem.tsx:20` — `toLocaleTimeString/DateString` без `timeZone`. Принимать `timezone` пропом из родителя (это `schedule.timezone`).

**B5.9** `components/staff-schedule/BookingsTab.tsx:35-37, 62` — `monday.setDate(now.getDate() - now.getDay() + ...)` и `new Date(d + 'T00:00:00').toLocaleDateString(undefined, ...)`. Начало недели считать в tz шаблона через `getWeekStart`/`getDayOfWeekInTz`. Форматирование даты — с `timeZone`.

**B5.10** `lib/calendar/hooks/useBookingActions.ts:55` — убрать fallback `Intl.DateTimeFormat().resolvedOptions().timeZone`. tz приходит явно из вызывающего кода после B3.2.

**B5.11** `lib/calendar/hooks/helpers.ts:20, 29-30` + `useFindNearestSlots.ts:62` + `components/booking/SlotListView.tsx:158-160` — `getFullYear/Month/Date/setDate` на Date-объектах из browser tz. Переписать на строковую арифметику (использовать `addDays`/`formatDateISO` из B5.4 после рефакторинга).

**Backend:**

**B5.12** `src/services/orgServices.js:23, 25` — `start.setHours(0,0,0,0)` / `end.setHours(23,59,59,999)` без tz. Принимать `timezone` из caller'а, считать границы через `parseWallClockToUtc(dateStr, "00:00", timezone)` / `parseWallClockToUtc(dateStr, "23:59:59", timezone)`.

**B5.13** `src/controllers/scheduleController.js:18` + `src/services/scheduleServices.js:25, 44, 50, 90` — `today.setHours(0,0,0,0)`, `d.setDate(d.getDate() - 1)` без tz. «Сегодня» брать в tz шаблона через `Intl.DateTimeFormat('en-CA', {timeZone: template.timezone}).format(new Date())`, арифметика дат — на строке YYYY-MM-DD.

**Общее:**

**B5.14** Единый helper в `shared/utils/timezone.js` (backend) и `lib/calendar/tz.ts` (frontend): `wallClockInTz(iso, tz) → {year, month, day, hour, minute, dayOfWeek}`. Вся кастомная арифметика времени должна пройти через него. Старые разбросанные `Intl.DateTimeFormat` вызовы убрать.

**B5.15** CI-guard: `npm run lint:tz` через скрипт `scripts/check-tz.mjs`, который grep'ит запрещённые паттерны (`\.getHours\(\)`, `\.getDate\(\)`, `\.setHours\(`, `toLocaleString` без `timeZone` и т.п.) в `src/**` backend и `lib/**`, `components/**`, `app/**` frontend. Pre-commit hook + GitHub Actions. Исключения помечаются `// tz-ok: <reason>` на строке, grep их игнорирует.

### Block 6 — Ownership & defaults модель

**Намерение:** У пользователя есть своя tz (для личных расписаний). У организации — своя tz (для org-расписаний). При регистрации/создании орги tz берётся из браузера, но редактируется.

**Отказ от User.timezone:** tz юзера живёт в его личном `ScheduleTemplate` (`orgId = null`), создаваемом при регистрации. Единое место правды, нет риска рассинхрона.

**B6.1** `src/models/Organization.js` — перенести `settings.defaultTimezone` → `Organization.timezone` (required, валидация через `isValidTimezone`). Убрать хардкод дефолта `"Europe/Kyiv"`. Сохранить миграцию: для существующих записей без поля — одноразовый backfill из `settings.defaultTimezone`, затем удаление `settings.defaultTimezone`.

**B6.2** `src/models/Location.js` — `timezone` остаётся optional. В бизнес-логике не используется (оставлено под будущую мультилокацию).

**B6.3** Registration: `src/modules/auth/controller/authController.js` (OAuth callback) и email-signup (если есть) принимают `timezone` в query/body. Валидация обязательная. `authServices.js:58` `createDefaultSchedule(newUser.id)` → `createDefaultSchedule(newUser.id, null, timezone)`.

**B6.4** Frontend: на странице OAuth-редиректа (`/login/google` → backend) фронт заранее шлёт `state` с `Intl.DateTimeFormat().resolvedOptions().timeZone`, бек читает из state после колбэка. Альтернатива: после callback — обязательный POST `/auth/init` с tz перед первым использованием. Выбираем state-подход (одна транзакция).

**B6.5** Создание орги: `src/controllers/orgController.js` принимает `timezone` в payload, валидация обязательная. Фронт `app/[locale]/org/create` форма: поле «Часовий пояс», дефолт `Intl.DateTimeFormat().resolvedOptions().timeZone`, компонент `TimezoneSelector` (реюз из B1.3). Подсказка «Визначено за браузером. Змініть, якщо компанія працює в іншій tz».

**B6.6** `createDefaultSchedule(staffId, orgId = null, timezone = null)`: если `timezone` передана — используем её; иначе если `orgId` — берём из `Organization.timezone`; иначе throw `timezone_required`. Хардкод `DEFAULT_TIMEZONE` удаляем из `createDefaultSchedule` (константа остаётся только для seed/тестов).

**B6.7** `rotateTemplate` (scheduleServices.js:63): убрать `timezone || DEFAULT_TIMEZONE` — если `timezone` пустая или не-IANA → throw `timezone_required`. Это уже частично покрыто B1.1, усиливаем до required без fallback.

**B6.8** UI «Мій часовий пояс» на сторінці профілю: читает `personalScheduleTemplate.timezone` (GET `/api/schedule?orgId=null`), PATCH через существующий flow `rotateTemplate`. Отдельного endpoint'а `/users/me/timezone` не создаём.

**B6.9** UI «Часовий пояс організації» в настройках орги: GET/PATCH `/api/org/:orgId`. При смене tz орги — warning «Нові розклади будуть створюватись у новій tz. Існуючі не зміняться». Существующие `ScheduleTemplate` не трогаем автоматически.

**B6.10** Миграция существующих юзеров: у кого в личном `ScheduleTemplate.timezone` уже стоит `DEFAULT_TIMEZONE` — оставляем, редактирование доступно в профиле.

## Non-goals

- Миграция «битых» записей (template с tz=UTC, броней с неверным startAt) — отдельно.
- Cron/reminder worker — отсутствует, отдельно.
- Изменение семантики reminder_24h (оставляем "24h elapsed UTC", не "same wall-clock").
- Мультиязычные названия weekdays на бэке — всегда `en-US short`.
- Поддержка tz на уровне отдельного override — всегда наследует от template.

## Dependencies between blocks

```
B1.3 (frontend sends tz)  ←  B1.1+B1.2 (backend accepts/validates)
B2.2 (backend weekday)    ←  независим
B2.1 (backend getDateRange) ← независим
B2.3 (cross-midnight)     ←  независим
B3.1 (bookings API tz)    ←  B3.2 (frontend sends tz)
B3.3-B3.6 (frontend rendering) ← независимы
B3.7 (frontend default removal) ← B1.3 должен быть готов (иначе пустой template без tz ломает UX)
B4.*  ← можно после B1-B3
B5.*  ← B5.1-B5.11 независимы друг от друга; B5.14 (helper) делаем первым, остальные — через него
B6.1 (Org.timezone required) ← B6.10 (миграция) должна идти одновременно
B6.3-B6.4 (registration tz) ← B6.6 (createDefaultSchedule) зависит
B6.5 (org create tz) ← B6.1, B6.6
B6.8-B6.9 (UI) ← B6.1 готов
```

## Testing

- **Backend unit**: `slotServices` — тесты для `getDateRange`, `dayOfWeek` с несовпадающей server/template tz (mock `process.env.TZ`).
- **Backend integration**: создание брони в tz клиента ≠ tz шаблона → слот заблокирован после. Уже существующий `billing.test.js` паттерн — новый файл `booking.test.js` с фокусом на tz.
- **Frontend**: compile + manual — загружаешь страницу `/my-schedule`, меняешь tz, сохраняешь, проверяешь что booking 08:00 в Kyiv-tz шаблоне блокирует слот у клиента в любой tz.

## Files touched (summary)

**Backend:**
- `src/services/scheduleServices.js`
- `src/controllers/scheduleController.js` (валидация tz + "сегодня" в tz)
- `src/services/slotServices.js`
- `src/services/orgServices.js` (B5.12 — границы дня в tz)
- `src/repository/bookingRepository.js` (`findByStaffAndDate` с overlap query)
- `src/controllers/bookingController.js`
- `src/services/telegramMessageFormatter.js`
- `src/services/notificationServices.js`
- `src/services/bookingServices.js` (валидация invitee tz)
- `src/shared/utils/timezone.js` (+ `wallClockInTz` helper B5.14)
- `src/models/ScheduleOverride.js` (jsdoc)
- `src/models/Organization.js` (B6.1 — timezone в корень, required)
- `src/controllers/orgController.js` (B6.5 — принять tz при создании)
- `src/modules/auth/controller/authController.js` (B6.3 — tz в OAuth state)
- `src/modules/auth/services/authServices.js` (B6.3 — проброс tz в createDefaultSchedule)
- `scripts/check-tz.mjs` (B5.15 — CI guard, новый файл)
- `scripts/migrations/2026-04-16-org-timezone-backfill.mjs` (B6.1 — backfill)

**Frontend:**
- `components/staff-schedule/ScheduleViewTab.tsx` (+ новый компонент `TimezoneSelector` — реюз в org create и профиле)
- `lib/calendar/utils.ts` (B5.4 — строковая арифметика дат)
- `lib/calendar/tz.ts` (B5.14 — `wallClockInTz` helper)
- `lib/calendar/CalendarCore.tsx` (B5.5, B5.3)
- `lib/calendar/hooks/useBookingActions.ts` (B5.10)
- `lib/calendar/hooks/useOrgSchedules.ts`
- `lib/calendar/hooks/helpers.ts` (B5.11)
- `lib/calendar/hooks/useFindNearestSlots.ts` (B5.11)
- `lib/booking-utils.ts` (B5.2)
- `components/booking/BookingPanelParts.tsx` (B5.1 — **виновник бага из скриншота**)
- `components/booking/BookingDetailsPanel.tsx` (B5.6)
- `components/booking/BookingDetailPanel.tsx` (B5.7)
- `components/booking/SlotListView.tsx` (B5.11)
- `components/booking/StaffSlotCard.tsx`
- `components/staff-schedule/BookingListItem.tsx` (B5.8)
- `components/staff-schedule/BookingDateGroup.tsx` (B5.8)
- `components/staff-schedule/OverrideListItem.tsx` (B5.8)
- `components/staff-schedule/BookingsTab.tsx` (B5.9)
- `app/[locale]/book/[staffSlug]/BookingPage.tsx`
- `app/[locale]/org/create/...` (B6.5 — форма с tz)
- `app/[locale]/profile/...` (B6.8 — секция «Мій часовий пояс»)
- `app/[locale]/org/[orgSlug]/settings/...` (B6.9 — секция «Часовий пояс організації»)
- `components/booking/OrgCalendarPage.tsx`
