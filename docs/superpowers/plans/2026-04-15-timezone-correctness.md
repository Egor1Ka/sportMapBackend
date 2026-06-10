# Timezone Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить все tz-протечки в booking-системе — schedule template владеет tz, UTC хранится в БД, server tz и browser tz не влияют на бизнес-логику.

**Architecture:** Один канонич­ный helper `getDayOfWeekInTz` на бэке и на фронте; валидация IANA на границах; `getTimezoneOffsetMin` переписан через `Intl.DateTimeFormat.formatToParts`; все чтения `getDay()/getDate()/setHours()` без явной tz заменены.

**Tech Stack:** Node.js ES modules, Express, Mongoose; Next.js 15 TS frontend; `Intl.DateTimeFormat` + `Intl.supportedValuesOf('timeZone')` вместо самописного парсинга.

**Repos:**

- Backend: `/Users/egorzozula/Desktop/BackendTemplate` (branch `feat/org-telegram-notifications`)
- Frontend: `/Users/egorzozula/Desktop/Slotix-fronted/Slotix-fronted` (branch `main`)

**Test runner:** backend использует Node test runner (`node --experimental-test-module-mocks --test`). Для tz-тестов создаём `src/__tests__/timezone.test.js`. Billing-тесты в `src/modules/billing/__tests__/` — паттерн для переиспользования.

---

## File Structure

**Backend — новые/изменённые:**

- `src/shared/utils/timezone.js` — переписываем `getTimezoneOffsetMin`, добавляем `isValidTimezone`, `getDayOfWeekInTz`.
- `src/__tests__/timezone.test.js` — новый, unit-tests для timezone helpers.
- `src/services/scheduleServices.js` — fallback → `DEFAULT_TIMEZONE`, reject пустую tz.
- `src/controllers/scheduleController.js` — валидация IANA на входе `handlePutTemplate`.
- `src/services/slotServices.js` — `getDateRange`, `dayOfWeek` переписаны.
- `src/repository/bookingRepository.js` — `findByStaffAndDate` ищет по overlap, а не по `startAt` внутри окна.
- `src/controllers/bookingController.js` — `handleGetBookingsByStaff` принимает `timezone`.
- `src/services/bookingServices.js` — валидация `invitee.timezone`.
- `src/services/telegramMessageFormatter.js` — fallback → template tz (принимает lead-host template).
- `src/services/notificationServices.js` — передаёт template tz вместо `org.settings.defaultTimezone`.
- `src/models/ScheduleOverride.js` — jsdoc о tz-наследовании.

**Frontend — новые/изменённые:**

- `lib/calendar/tz.ts` — новый, `getDayOfWeekInTz`, `todayInTz`.
- `components/staff-schedule/ScheduleViewTab.tsx` — tz-picker + отправка tz в save.
- `components/staff-schedule/TimezoneSelector.tsx` — новый компонент.
- `lib/booking-api-client.ts` — `updateTemplate(..., timezone)`, `getBookingsByStaff(..., timezone)`.
- `lib/booking-utils.ts` — `timeToMinFromISO` на вход `scheduleTimezone`, `toCalendarDisplayBooking` принимает tz.
- `lib/calendar/utils.ts` — `getDay()` сайты заменены на `getDayOfWeekInTz`.
- `lib/calendar/CalendarCore.tsx` — `new Date(...).getDay()` заменён.
- `lib/calendar/hooks/useBookingActions.ts`, `useOrgSchedules.ts` — шлют tz.
- `components/booking/StaffSlotCard.tsx` — `today` в tz расписания.
- `app/[locale]/book/[staffSlug]/BookingPage.tsx`, `components/booking/OrgCalendarPage.tsx` — убираем `DEFAULT_SCHEDULE.timezone = browser tz`.

---

### Task 1: `getTimezoneOffsetMin` через `Intl.DateTimeFormat`

**Files:**
- Modify: `src/shared/utils/timezone.js`
- Create: `src/__tests__/timezone.test.js`

- [ ] **Step 1: Написать failing-тест**

Создать `src/__tests__/timezone.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getTimezoneOffsetMin } from "../shared/utils/timezone.js";

test("getTimezoneOffsetMin: Europe/Kyiv in April (DST) = +180", () => {
  const d = new Date("2026-04-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "Europe/Kyiv"), 180);
});

test("getTimezoneOffsetMin: Europe/Kyiv in January (no DST) = +120", () => {
  const d = new Date("2026-01-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "Europe/Kyiv"), 120);
});

test("getTimezoneOffsetMin: UTC = 0", () => {
  const d = new Date("2026-04-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "UTC"), 0);
});

test("getTimezoneOffsetMin: America/Los_Angeles April (DST) = -420", () => {
  const d = new Date("2026-04-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "America/Los_Angeles"), -420);
});

test("getTimezoneOffsetMin: Asia/Kolkata (half-hour offset) = +330", () => {
  const d = new Date("2026-04-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "Asia/Kolkata"), 330);
});
```

- [ ] **Step 2: Запустить и убедиться что проходит (текущая реализация случайно работает)**

Run: `node --test src/__tests__/timezone.test.js`
Expected: 5/5 tests pass.

Если тесты проходят — текущая реализация корректна, но мы всё равно её заменяем на более надёжную для долгосрочной стабильности.

- [ ] **Step 3: Переписать реализацию**

В `src/shared/utils/timezone.js` заменить функцию `getTimezoneOffsetMin`:

```js
const getTimezoneOffsetMin = (date, timezone) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
    hour: "numeric",
  }).formatToParts(date);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");
  if (!offsetPart) return 0;
  const match = offsetPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + minutes);
};
```

- [ ] **Step 4: Повторить тесты**

Run: `node --test src/__tests__/timezone.test.js`
Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/timezone.js src/__tests__/timezone.test.js
git commit -m "refactor(tz): getTimezoneOffsetMin через Intl.formatToParts + тесты

Убираем хрупкий парсинг toLocaleString. Сохраняется поведение для DST,
half-hour offsets (Asia/Kolkata), UTC."
```

---

### Task 2: `isValidTimezone` и `getDayOfWeekInTz` helpers

**Files:**
- Modify: `src/shared/utils/timezone.js`
- Modify: `src/__tests__/timezone.test.js`

- [ ] **Step 1: Тесты**

Добавить в `src/__tests__/timezone.test.js`:

```js
import {
  getTimezoneOffsetMin,
  isValidTimezone,
  getDayOfWeekInTz,
} from "../shared/utils/timezone.js";

test("isValidTimezone: корректная IANA", () => {
  assert.equal(isValidTimezone("Europe/Kyiv"), true);
  assert.equal(isValidTimezone("UTC"), true);
  assert.equal(isValidTimezone("America/Los_Angeles"), true);
});

test("isValidTimezone: некорректная строка", () => {
  assert.equal(isValidTimezone("Not/Real"), false);
  assert.equal(isValidTimezone(""), false);
  assert.equal(isValidTimezone(null), false);
  assert.equal(isValidTimezone(undefined), false);
});

test("getDayOfWeekInTz: 2026-04-15 в Europe/Kyiv = wed", () => {
  assert.equal(getDayOfWeekInTz("2026-04-15", "Europe/Kyiv"), "wed");
});

test("getDayOfWeekInTz: 2026-04-19 в UTC = sun", () => {
  assert.equal(getDayOfWeekInTz("2026-04-19", "UTC"), "sun");
});

test("getDayOfWeekInTz: одна дата, разные tz — weekday стабилен (используется 12:00 UTC anchor)", () => {
  // 2026-04-15 — среда. В любой tz от -12 до +14 дата 12:00 UTC останется 15 апреля.
  assert.equal(getDayOfWeekInTz("2026-04-15", "America/Los_Angeles"), "wed");
  assert.equal(getDayOfWeekInTz("2026-04-15", "Asia/Tokyo"), "wed");
});
```

- [ ] **Step 2: Запустить — fail**

Run: `node --test src/__tests__/timezone.test.js`
Expected: 4 новых теста fail — функции не импортируются.

- [ ] **Step 3: Реализация**

Добавить в `src/shared/utils/timezone.js` после `getTimezoneOffsetMin`:

```js
const isValidTimezone = (tz) => {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const WEEKDAY_MAP = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

const getDayOfWeekInTz = (dateStr, timezone) => {
  const anchor = new Date(`${dateStr}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).format(anchor);
  return WEEKDAY_MAP[weekday] || "sun";
};
```

Обновить экспорт:

```js
export {
  getTimezoneOffsetMin,
  parseWallClockToUtc,
  isValidTimezone,
  getDayOfWeekInTz,
};
```

- [ ] **Step 4: Tests pass**

Run: `node --test src/__tests__/timezone.test.js`
Expected: 9/9 pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/timezone.js src/__tests__/timezone.test.js
git commit -m "feat(tz): helpers isValidTimezone и getDayOfWeekInTz

Anchor 12:00 UTC гарантирует одинаковый weekday для всех tz [-12..+14].
Используем en-US 'short' и маппим в lowercase 3-letter. isValidTimezone
через try/catch на Intl.DateTimeFormat."
```

---

### Task 3: `rotateTemplate` fallback + валидация tz в контроллере

**Files:**
- Modify: `src/services/scheduleServices.js:63`
- Modify: `src/controllers/scheduleController.js`

- [ ] **Step 1: Fallback в `rotateTemplate`**

В `src/services/scheduleServices.js:48-70` заменить `rotateTemplate`:

```js
const rotateTemplate = async ({ staffId, orgId, locationId, weeklyHours, slotMode, slotStepMin, timezone }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const current = await findCurrentTemplate(staffId, orgId, locationId);
  if (current) {
    await updateTemplateValidTo(current._id, yesterday(today));
  }

  const newTemplate = await createTemplate({
    staffId,
    orgId: orgId || null,
    locationId: locationId || null,
    validFrom: today,
    validTo: null,
    timezone: timezone || DEFAULT_TIMEZONE,
    slotMode: slotMode || "fixed",
    slotStepMin: slotStepMin ?? 30,
    weeklyHours,
  });

  return newTemplate;
};
```

- [ ] **Step 2: Валидация tz в контроллере**

В `src/controllers/scheduleController.js` в схеме `putTemplateSchema` добавить поле и в `handlePutTemplate` — проверку через `isValidTimezone` (если `timezone` передан):

```js
import { isValidTimezone } from "../shared/utils/timezone.js";

const putTemplateSchema = {
  staffId: { type: "string", required: true },
  weeklyHours: { type: "array", required: true, items: { type: "object", properties: weeklyHourItemSchema } },
  slotMode: { type: "string", required: false },
  slotStepMin: { type: "number", required: false },
  timezone: { type: "string", required: false },
};
```

В теле `handlePutTemplate` сразу после `validateSchema`:

```js
if (req.body.timezone !== undefined && !isValidTimezone(req.body.timezone)) {
  return httpResponse(res, generalStatus.BAD_REQUEST, { errors: { timezone: "invalid IANA timezone" } });
}
```

- [ ] **Step 3: Syntax check**

Run: `node --check src/services/scheduleServices.js && node --check src/controllers/scheduleController.js && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/services/scheduleServices.js src/controllers/scheduleController.js
git commit -m "fix(schedule): rotateTemplate fallback → DEFAULT_TIMEZONE + валидация tz

Раньше пустой timezone молча стирался в UTC. Теперь — Europe/Kyiv (дефолт),
и контроллер отбивает невалидные IANA-строки 400."
```

---

### Task 4: `slotServices.getDateRange` — безопасный парсинг `YYYY-MM-DD`

**Files:**
- Modify: `src/services/slotServices.js:41-53`
- Modify: `src/__tests__/timezone.test.js` (integration-style)

- [ ] **Step 1: Тест на сдвиг окна в tz шаблона (нет зависимости от server tz)**

Добавить тест в `src/__tests__/timezone.test.js`:

```js
// helper чтобы безопасно протестить getDateRange без mongoose-коннекта
import { getDateRangeForTest } from "../services/slotServices.js";

test("getDateRange: 2026-04-15 в Europe/Kyiv (+3 DST) → 2026-04-14T21:00 .. 2026-04-15T20:59:59.999", () => {
  const { dateStart, dateEnd } = getDateRangeForTest("2026-04-15", "Europe/Kyiv");
  assert.equal(dateStart.toISOString(), "2026-04-14T21:00:00.000Z");
  assert.equal(dateEnd.toISOString(), "2026-04-15T20:59:59.999Z");
});

test("getDateRange: 2026-04-15 в UTC → 2026-04-15T00:00 .. 2026-04-15T23:59:59.999", () => {
  const { dateStart, dateEnd } = getDateRangeForTest("2026-04-15", "UTC");
  assert.equal(dateStart.toISOString(), "2026-04-15T00:00:00.000Z");
  assert.equal(dateEnd.toISOString(), "2026-04-15T23:59:59.999Z");
});

test("getDateRange: 2026-04-15 в America/Los_Angeles (-7 DST) → 2026-04-15T07:00 .. 2026-04-16T06:59:59.999", () => {
  const { dateStart, dateEnd } = getDateRangeForTest("2026-04-15", "America/Los_Angeles");
  assert.equal(dateStart.toISOString(), "2026-04-15T07:00:00.000Z");
  assert.equal(dateEnd.toISOString(), "2026-04-16T06:59:59.999Z");
});
```

- [ ] **Step 2: Fail — функция не экспортируется**

Run: `node --test src/__tests__/timezone.test.js`
Expected: 3 теста fail (import error).

- [ ] **Step 3: Переписать `getDateRange` и экспортировать**

В `src/services/slotServices.js` заменить строки 41-53 на:

```js
const parseDateStr = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month: month - 1, day };
};

const getDateRange = (dateStr, timezone) => {
  const { year, month, day } = parseDateStr(dateStr);
  const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  const offsetStart = getTimezoneOffsetMin(dayStart, timezone) * 60000;
  const offsetEnd = getTimezoneOffsetMin(dayEnd, timezone) * 60000;
  return {
    dateStart: new Date(dayStart.getTime() - offsetStart),
    dateEnd: new Date(dayEnd.getTime() - offsetEnd),
  };
};

// Экспортируется только для unit-тестов.
const getDateRangeForTest = getDateRange;
```

Также добавить в список `export`ов:

```js
export { getSlotsForDate, getDateRangeForTest };
```

- [ ] **Step 4: Tests pass**

Run: `node --test src/__tests__/timezone.test.js`
Expected: 12/12 pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/slotServices.js src/__tests__/timezone.test.js
git commit -m "fix(slots): getDateRange парсит YYYY-MM-DD явно, не через server tz

new Date('2026-04-15').getDate() читает компоненты в tz сервера. Теперь
парсим строку руками и собираем boundaries в template tz через
getTimezoneOffsetMin. Отдельный offset для start/end защищает от DST-дня."
```

---

### Task 5: `slotServices.dayOfWeek` через `getDayOfWeekInTz`

**Files:**
- Modify: `src/services/slotServices.js:72-82`

- [ ] **Step 1: Заменить вычисление weekday**

В `src/services/slotServices.js` удалить строку `const WEEKDAY_INDEX = [...]` в начале файла и импортировать helper. Заменить вычисление `dayOfWeek` в `getSlotsForDate`:

Сверху файла:

```js
import { getTimezoneOffsetMin, getDayOfWeekInTz } from "../shared/utils/timezone.js";
```

Удалить:
```js
const WEEKDAY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
```

В `getSlotsForDate` заменить строки 71-72:

```js
const dayOfWeek = getDayOfWeekInTz(date, template.timezone);
```

(Удалить `const requestDate = new Date(date);` и `const dayOfWeek = WEEKDAY_INDEX[requestDate.getDay()];`.)

- [ ] **Step 2: Повторный прогон diag скрипта**

Run: `node --env-file=.env src/scripts/diag-slots.js`
Expected: слоты возвращаются для правильного weekday шаблона (пока tz=UTC — будет UTC weekday; после Task 12 и ручного обновления tz — будет Kyiv weekday).

- [ ] **Step 3: Commit**

```bash
git add src/services/slotServices.js
git commit -m "fix(slots): dayOfWeek через getDayOfWeekInTz, без server-tz getDay

Убираем хрупкий new Date(dateStr).getDay() — на любом сервере кроме UTC
пограничные дни недели ломались."
```

---

### Task 6: Кроссполуночные брони — overlap-query в `findByStaffAndDate`

**Files:**
- Modify: `src/repository/bookingRepository.js:20-27`
- Modify: `src/services/slotServices.js` (toBookingSlot для обрезки)

- [ ] **Step 1: Overlap-query**

В `src/repository/bookingRepository.js` заменить `findByStaffAndDate`:

```js
const findByStaffAndDate = async (staffId, dateStart, dateEnd) => {
  const docs = await Booking.find({
    "hosts.userId": staffId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    startAt: { $lt: dateEnd },
    endAt: { $gt: dateStart },
  });
  return docs;
};
```

(Старый query искал `startAt ∈ [dateStart, dateEnd)`. Новый — overlap.)

- [ ] **Step 2: Обрезка в `toBookingSlot`**

В `src/services/slotServices.js` заменить `toBookingSlot`:

```js
const toBookingSlot = (template, bufferAfter, booking, dateStart, dateEnd) => {
  const effectiveStart = booking.startAt < dateStart ? dateStart : booking.startAt;
  const effectiveEnd = booking.endAt > dateEnd ? dateEnd : booking.endAt;
  const tzOffset = getTimezoneOffsetMin(effectiveStart, template.timezone);
  const startMin =
    effectiveStart.getUTCHours() * 60 + effectiveStart.getUTCMinutes() + tzOffset;
  const durationMs = effectiveEnd.getTime() - effectiveStart.getTime();
  const duration = Math.round(durationMs / 60000) + bufferAfter;
  return { startMin, duration };
};
```

И заменить вызов `const toBooking = (b) => toBookingSlot(template, bufferAfter, b);` на:

```js
const toBooking = (b) => toBookingSlot(template, bufferAfter, b, dateStart, dateEnd);
```

- [ ] **Step 3: Diag script — убедиться что обычные брони не сломались**

Run: `node --env-file=.env src/scripts/diag-slots.js`
Expected: booking slots для дня без кросс-полуночи считаются как раньше (startMin/duration корректные).

- [ ] **Step 4: Commit**

```bash
git add src/repository/bookingRepository.js src/services/slotServices.js
git commit -m "fix(slots): кроссполуночные брони блокируют оба дня

findByStaffAndDate искал startAt внутри окна — бронь 23:30–00:30 пропадала
для второго дня. Теперь overlap-query + обрезка в toBookingSlot по
границам запрошенного дня."
```

---

### Task 7: `handleGetBookingsByStaff` принимает `timezone`

**Files:**
- Modify: `src/controllers/bookingController.js:62-91`

- [ ] **Step 1: Валидация tz и wall-clock парсинг**

Заменить `handleGetBookingsByStaff`:

```js
import { isValidTimezone } from "../shared/utils/timezone.js";
import { parseWallClockToUtc } from "../shared/utils/timezone.js";

const handleGetBookingsByStaff = async (req, res) => {
  try {
    const { staffId, dateFrom, dateTo, locationId, orgId, status, timezone } = req.query;

    if (!staffId || !isValidObjectId(staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!dateFrom || !dateTo) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!timezone || !isValidTimezone(timezone)) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: { timezone: "required, must be IANA" } });
    }

    const statuses = status ? status.split(",") : undefined;

    const dateFromUtc = parseWallClockToUtc(`${dateFrom}T00:00:00`, timezone);
    const dateToUtc = parseWallClockToUtc(`${dateTo}T23:59:59.999`, timezone);

    const bookings = await getBookingsByStaff({
      staffId,
      dateFrom: dateFromUtc,
      dateTo: dateToUtc,
      locationId: locationId || undefined,
      orgId: orgId ? orgId : null,
      statuses,
    });

    return httpResponse(res, generalStatus.SUCCESS, bookings);
  } catch (error) {
    return httpResponseError(res, error);
  }
};
```

Удалить уже существующий импорт `isValidTimezone`/`parseWallClockToUtc` если он уже есть — не дублировать.

- [ ] **Step 2: Syntax check**

Run: `node --check src/controllers/bookingController.js && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/controllers/bookingController.js
git commit -m "fix(bookings): GET /bookings/by-staff обязательно принимает timezone

Раньше dateFrom/dateTo парсились в tz сервера → Kyiv-клиент терял вечерние
брони своего дня и ловил утренние следующего. Теперь обязателен query
?timezone=, валидируется через isValidTimezone, парсится wall-clock."
```

---

### Task 8: Telegram formatter — fallback на template tz lead-хоста

**Files:**
- Modify: `src/services/notificationServices.js`
- Modify: `src/services/telegramMessageFormatter.js:12-16`

- [ ] **Step 1: Найти где в `notificationServices.js` вычисляется tz для сообщения**

Run: `grep -n "defaultTimezone\|timezone\|formatNotificationMessage" src/services/notificationServices.js`

Определить, где собирается `timezone`, который передаётся в `formatNotificationMessage`. Скорее всего — из `org.settings.defaultTimezone`.

- [ ] **Step 2: Заменить источник tz**

В `src/services/notificationServices.js` найти место, где получается `timezone` для telegram:

```js
const timezone = org?.settings?.defaultTimezone || "Europe/Kyiv";
```

Заменить на (добавив импорт `findCurrentTemplate`):

```js
import { findCurrentTemplate } from "../repository/scheduleTemplateRepository.js";

const leadHostId = booking.hosts?.[0]?.userId;
const leadTemplate = leadHostId
  ? await findCurrentTemplate(leadHostId.toString(), booking.orgId || null, null)
  : null;
const timezone = leadTemplate?.timezone || "Europe/Kyiv";
```

- [ ] **Step 3: Formatter — отражает намерение в коде**

В `src/services/telegramMessageFormatter.js:13-16` оставить текущий код — он уже принимает `timezone` и имеет Kyiv-fallback. Это страховка; реальный source-of-truth теперь в notificationServices. Ничего не правим в formatter.

- [ ] **Step 4: Syntax check**

Run: `node --check src/services/notificationServices.js && echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/services/notificationServices.js
git commit -m "fix(notifications): timezone для telegram из template lead-хоста

Раньше зависели от org.settings.defaultTimezone — solo и новые орги давали
null, formatter падал на хардкод 'Europe/Kyiv'. Теперь берём tz активного
шаблона ведущего хоста."
```

---

### Task 9: Валидация `invitee.timezone` на create booking

**Files:**
- Modify: `src/services/bookingServices.js`

- [ ] **Step 1: Добавить валидацию**

В `src/services/bookingServices.js` добавить импорт:

```js
import { parseWallClockToUtc, isValidTimezone } from "../shared/utils/timezone.js";
```

В `createBooking` сразу после проверки `if (!eventType)`:

```js
const clientTimezone = isValidTimezone(timezone) ? timezone : null;
```

В `bookingData.timezone` передать `clientTimezone` вместо исходного `timezone`:

```js
timezone: clientTimezone,
```

- [ ] **Step 2: Syntax check**

Run: `node --check src/services/bookingServices.js && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/services/bookingServices.js
git commit -m "fix(booking): валидируем invitee.timezone через isValidTimezone

Невалидные IANA-строки больше не попадают в БД — вместо них сохраняем null.
Formatter использует template tz когда booking.timezone отсутствует."
```

---

### Task 10: `ScheduleOverride` — jsdoc о tz-наследовании

**Files:**
- Modify: `src/models/ScheduleOverride.js`

- [ ] **Step 1: Добавить jsdoc**

В `src/models/ScheduleOverride.js` перед определением поля `slots` (или в начале schema) добавить jsdoc-блок:

```js
/**
 * Переопределение графика на конкретную дату.
 *
 * ВАЖНО: `slots[].start` / `slots[].end` — HH:MM в timezone активного
 * ScheduleTemplate этого staff/org/location на момент чтения.
 * Override не хранит свой timezone — если tz шаблона меняется,
 * интерпретация override'ов меняется тоже.
 */
```

- [ ] **Step 2: Commit**

```bash
git add src/models/ScheduleOverride.js
git commit -m "docs(schedule): override наследует tz от template — явный jsdoc"
```

---

### Task 11: Frontend — `getDayOfWeekInTz` и `todayInTz` helpers

**Files:**
- Create: `lib/calendar/tz.ts`

Working dir: `/Users/egorzozula/Desktop/Slotix-fronted/Slotix-fronted`.

- [ ] **Step 1: Создать helper**

Создать `lib/calendar/tz.ts`:

```ts
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const getDayOfWeekInTz = (dateStr: string, timezone: string): number => {
  const anchor = new Date(`${dateStr}T12:00:00Z`)
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: timezone,
  }).format(anchor)
  return WEEKDAY_INDEX[weekday] ?? 0
}

const todayInTz = (timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())

export { getDayOfWeekInTz, todayInTz }
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero новых ошибок.

- [ ] **Step 3: Commit**

```bash
git add lib/calendar/tz.ts
git commit -m "feat(calendar): tz helpers — getDayOfWeekInTz и todayInTz

Anchor 12:00 UTC для стабильного weekday в любой tz. en-CA формат дает
YYYY-MM-DD для todayInTz."
```

---

### Task 12: Frontend — `ScheduleViewTab` tz-picker + отправка tz

**Files:**
- Create: `components/staff-schedule/TimezoneSelector.tsx`
- Modify: `components/staff-schedule/ScheduleViewTab.tsx`
- Modify: `lib/booking-api-client.ts` (сигнатура `updateTemplate`)

- [ ] **Step 1: Создать `TimezoneSelector.tsx`**

Создать `components/staff-schedule/TimezoneSelector.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface TimezoneSelectorProps {
  value: string
  onChange: (tz: string) => void
  label: string
}

const getSupportedTimezones = (): string[] => {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  if (intl.supportedValuesOf) return intl.supportedValuesOf('timeZone')
  return ['UTC', 'Europe/Kyiv', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo']
}

function TimezoneSelector({ value, onChange, label }: TimezoneSelectorProps) {
  const options = useMemo(getSupportedTimezones, [])
  const renderOption = (tz: string) => (
    <SelectItem key={tz} value={tz}>
      {tz}
    </SelectItem>
  )

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full max-w-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{options.map(renderOption)}</SelectContent>
      </Select>
    </div>
  )
}

export { TimezoneSelector }
```

- [ ] **Step 2: Расширить `scheduleApi.updateTemplate` в `lib/booking-api-client.ts`**

Run: `grep -n "updateTemplate" lib/booking-api-client.ts` — найти текущую сигнатуру.

Добавить параметр `timezone?: string` в конец сигнатуры и прокинуть в body. Пример (подстроить под актуальный код):

```ts
updateTemplate: async (
  staffId: string,
  orgId: string | null,
  weeklyHours: WeeklyHours[],
  slotMode?: SlotMode,
  slotStepMin?: number,
  timezone?: string,
) => {
  const body: Record<string, unknown> = { staffId, weeklyHours }
  if (orgId !== null) body.orgId = orgId
  if (slotMode !== undefined) body.slotMode = slotMode
  if (slotStepMin !== undefined) body.slotStepMin = slotStepMin
  if (timezone !== undefined) body.timezone = timezone
  return apiClient.put('/schedule/template', body)
}
```

- [ ] **Step 3: Интегрировать в `ScheduleViewTab.tsx`**

В `components/staff-schedule/ScheduleViewTab.tsx`:

Импорт:

```tsx
import { TimezoneSelector } from './TimezoneSelector'
```

В `ScheduleViewTab` после `useEffect` с `setLocalSlotStep` добавить state:

```tsx
const [localTimezone, setLocalTimezone] = useState<string>(
  schedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
)

useEffect(() => {
  if (schedule) setLocalTimezone(schedule.timezone)
}, [schedule])
```

Изменить `handleSave` чтобы слал tz:

```tsx
const handleSave = async (weeklyHours: WeeklyHours[]) => {
  try {
    await scheduleApi.updateTemplate(
      staffId,
      orgId ?? null,
      weeklyHours,
      localSlotMode,
      localSlotStep,
      localTimezone,
    )
    await fetchSchedule()
    toast.success(t('scheduleSaved'))
  } catch (err) {
    const message = err instanceof Error ? err.message : t('scheduleSaveError')
    toast.error(message)
    throw err
  }
}
```

Аналогично обновить `handleSlotModeChange` и `handleSlotStepChange` — передать `localTimezone` последним аргументом.

Добавить tz-изменение:

```tsx
const handleTimezoneChange = async (tz: string) => {
  if (!schedule) return
  setLocalTimezone(tz)
  setSavingMode(true)
  try {
    await scheduleApi.updateTemplate(
      staffId,
      orgId ?? null,
      schedule.weeklyHours,
      localSlotMode,
      localSlotStep,
      tz,
    )
    await fetchSchedule()
  } catch (err) {
    setLocalTimezone(schedule.timezone)
    const message = err instanceof Error ? err.message : t('scheduleSaveError')
    toast.error(message)
  } finally {
    setSavingMode(false)
  }
}
```

В JSX в блок с `SlotModeSelector` / `SlotStepSelect` добавить перед ними:

```tsx
<div className={cn(savingMode && 'pointer-events-none opacity-50')}>
  <TimezoneSelector
    value={localTimezone}
    onChange={handleTimezoneChange}
    label={t('timezone')}
  />
</div>
```

- [ ] **Step 4: Добавить ключ `timezone` в локали**

В `i18n/messages/en.json` и `i18n/messages/uk.json` (пути — подтвердить через `ls i18n/messages`) в секцию `staffSchedule` добавить:

```json
"timezone": "Timezone"
```

и

```json
"timezone": "Часовий пояс"
```

соответственно.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: без новых ошибок.

- [ ] **Step 6: Commit**

```bash
git add lib/booking-api-client.ts components/staff-schedule/ScheduleViewTab.tsx components/staff-schedule/TimezoneSelector.tsx i18n/messages
git commit -m "feat(schedule): tz picker в редакторе расписания

Новый компонент TimezoneSelector на базе Intl.supportedValuesOf('timeZone').
ScheduleViewTab шлёт tz в updateTemplate при любом сохранении (weeklyHours,
slotMode, slotStep, timezone)."
```

---

### Task 13: Frontend — bookings API client шлёт `timezone`

**Files:**
- Modify: `lib/booking-api-client.ts`
- Modify: `lib/calendar/hooks/useBookingActions.ts`
- Modify: `lib/calendar/hooks/useOrgSchedules.ts`
- Modify: `lib/calendar/hooks/useStaffBookings.ts`

- [ ] **Step 1: Найти все вызовы `getBookingsByStaff`**

Run: `grep -rn "getBookingsByStaff\|bookingsByStaff" lib/ components/ app/`

Ожидается: несколько мест.

- [ ] **Step 2: Расширить сигнатуру**

В `lib/booking-api-client.ts` у `bookingsApi.getByStaff` (или как называется метод) добавить параметр `timezone: string` и прокинуть в query-params.

- [ ] **Step 3: Обновить caller'ы**

Во всех вызовах, найденных в Step 1, передать `schedule.timezone` (берётся из `useStaffSchedule`/`useOrgSchedules` в контексте). Если schedule ещё не загружен — пропустить вызов (`enabled: Boolean(schedule)`).

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add lib/
git commit -m "fix(bookings): GET bookings by staff шлёт tz шаблона

Раньше окно дат интерпретировалось в tz сервера. Теперь фронт всегда
передаёт schedule.timezone."
```

---

### Task 14: Frontend — `timeToMinFromISO` → на вход tz расписания

**Files:**
- Modify: `lib/booking-utils.ts`
- Modify: все caller'ы `toCalendarDisplayBooking`

- [ ] **Step 1: Изменить сигнатуру**

В `lib/booking-utils.ts`:

```ts
const toCalendarDisplayBooking =
  (staff: StaffInfo, scheduleTimezone: string) =>
  (b: StaffBooking): CalendarDisplayBooking => ({
    startMin: timeToMinFromISO(b.startAt, scheduleTimezone),
    duration: diffMinutes(b.startAt, b.endAt),
    label: `${b.eventTypeName} — ${staff.name}`,
    color: b.color,
    date: dateFromISO(b.startAt),
    bookingId: b.id,
    status: b.status,
    staffName: staff.name,
    staffAvatar: staff.avatar,
    timezone: scheduleTimezone,
  })
```

- [ ] **Step 2: Найти caller'ы**

Run: `grep -rn "toCalendarDisplayBooking" lib/ components/ app/`

- [ ] **Step 3: Обновить caller'ы**

В каждом передать `schedule.timezone` вторым аргументом curry. Пример изменения:

```ts
// было
bookings.map(toCalendarDisplayBooking(staff))
// стало
bookings.map(toCalendarDisplayBooking(staff, schedule.timezone))
```

- [ ] **Step 4: Также `dateFromISO`**

`dateFromISO` сейчас берёт `iso.split('T')[0]` — это UTC-дата. Для корректной даты в tz расписания заменить:

```ts
const dateFromISO = (iso: string, timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(iso))
```

И обновить вызов в `toCalendarDisplayBooking`:

```ts
date: dateFromISO(b.startAt, scheduleTimezone),
```

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: без новых ошибок.

- [ ] **Step 6: Commit**

```bash
git add lib/booking-utils.ts
git commit -m "fix(calendar): booking позиция на сетке — в tz расписания

timeToMinFromISO раньше использовал booking.timezone (tz клиента на
момент создания). Ось сетки рисуется в tz template — несовпадение давало
смещение карточек. Теперь обе величины в одной tz."
```

---

### Task 15: Frontend — `lib/calendar/utils.ts` и `CalendarCore.tsx` — getDay sites

**Files:**
- Modify: `lib/calendar/utils.ts`
- Modify: `lib/calendar/CalendarCore.tsx`
- Modify: `lib/calendar/hooks/useOrgSchedules.ts`

- [ ] **Step 1: Найти все сайты**

Run: `grep -n "getDay()" lib/calendar/utils.ts lib/calendar/CalendarCore.tsx lib/calendar/hooks/useOrgSchedules.ts`

- [ ] **Step 2: Заменить — `lib/calendar/utils.ts`**

Для каждой функции, которая считает weekday (строки 119, 146, 170, 237), принимает `timezone` параметром и использует `getDayOfWeekInTz`:

Импорт:
```ts
import { getDayOfWeekInTz } from './tz'
```

Пример — если функция `getWorkHoursForDate(weeklyHours, dateStr)` использовала `new Date(dateStr).getDay()`:

```ts
// было
const dow = new Date(dateStr + 'T00:00:00').getDay()

// стало
const dow = getDayOfWeekInTz(dateStr, timezone)
```

Сигнатуры функций расширяются `timezone: string`. Все caller'ы — передать `schedule.timezone`.

- [ ] **Step 3: Заменить — `CalendarCore.tsx:509`**

В `components/CalendarCore.tsx:509`:

```tsx
// было
const dayOfWeek = new Date(dayDate + 'T00:00:00').getDay()

// стало — прокинуть schedule.timezone через пропсы или контекст
const dayOfWeek = getDayOfWeekInTz(dayDate, scheduleTimezone)
```

Если в компоненте нет прямого доступа к schedule — добавить проп `scheduleTimezone: string`. Обновить все caller'ы — `BookingPage.tsx`, `OrgCalendarPage.tsx` — передают `schedule.timezone`.

- [ ] **Step 4: Заменить — `useOrgSchedules.ts:29,150`**

Те же замены: импорт `getDayOfWeekInTz`, функции принимают tz, используют helper.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add lib/calendar components/
git commit -m "fix(calendar): все getDay() сайты — через getDayOfWeekInTz

Раньше browser tz определяла weekday в UI — клиент из другой tz видел
сдвиг на границах суток. Теперь weekday всегда вычисляется в tz
расписания."
```

---

### Task 16: Frontend — `StaffSlotCard` today cutoff в tz расписания

**Files:**
- Modify: `components/booking/StaffSlotCard.tsx:32`

- [ ] **Step 1: Заменить `today`**

В `components/booking/StaffSlotCard.tsx`:

```tsx
import { todayInTz } from '@/lib/calendar/tz'

// внутри компонента:
const todayStr = todayInTz(scheduleTimezone)
const isPast = slotDateStr < todayStr
```

Если компонент не получал `scheduleTimezone` — добавить проп. Update caller'ов.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add components/booking/StaffSlotCard.tsx
git commit -m "fix(slot-card): 'сегодня' в tz расписания, не браузера

Kyiv-расписание смотрит клиент из LA — раньше 'past' считалось его UTC-8
днём. Теперь — днём специалиста."
```

---

### Task 17: Frontend — убрать `DEFAULT_SCHEDULE.timezone = browser tz`

**Files:**
- Modify: `app/[locale]/book/[staffSlug]/BookingPage.tsx:72`
- Modify: `components/booking/OrgCalendarPage.tsx:56`

- [ ] **Step 1: `BookingPage.tsx`**

Заменить в `app/[locale]/book/[staffSlug]/BookingPage.tsx` строки вокруг 66-73 (объявление `DEFAULT_SCHEDULE`):

Удалить `timezone: Intl.DateTimeFormat().resolvedOptions().timeZone` из `DEFAULT_SCHEDULE`.

Если `DEFAULT_SCHEDULE` используется когда `schedule` не загрузился — заменить на null-guard:

```tsx
if (!schedule) {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-muted-foreground text-sm">{t('loading')}</p>
    </div>
  )
}
```

И убрать `scheduleSource = schedule ?? DEFAULT_SCHEDULE` — всегда использовать `schedule`.

Константу `DEFAULT_SCHEDULE` удалить целиком.

- [ ] **Step 2: `OrgCalendarPage.tsx`**

Аналогичная замена в `components/booking/OrgCalendarPage.tsx`.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: без новых ошибок.

- [ ] **Step 4: Commit**

```bash
git add app/ components/
git commit -m "fix(booking): убрать browser-tz fallback для расписания

DEFAULT_SCHEDULE с Intl.DateTimeFormat().resolvedOptions().timeZone
давал случайную tz сетке, когда template ещё не загрузился. Теперь
показываем spinner, рендерим только после загрузки."
```

---

## Self-Review

**Spec coverage:**
- B1.1 — Task 3 ✅
- B1.2 — Task 3 ✅
- B1.3 — Task 12 ✅
- B2.1 — Task 4 ✅
- B2.2 — Task 5 ✅
- B2.3 — Task 6 ✅
- B3.1 — Task 7 ✅
- B3.2 — Task 13 ✅
- B3.3 — Task 14 ✅
- B3.4 — Task 15 ✅
- B3.5 — Task 15 ✅
- B3.6 — Task 16 ✅
- B3.7 — Task 17 ✅
- B4.1 — Task 8 ✅
- B4.2 — Task 8 ✅
- B4.3 — Task 9 ✅
- B4.4 — Task 1 ✅
- B4.5 — Task 10 ✅

**Placeholder scan:** Step 1 Task 8 / Step 1 Task 13 / Step 1 Task 15 содержат `grep` для уточнения актуальных строк — это намеренно, так как точные номера плавают; сам шаг ещё включает конкретную замену. Task 12 Step 4 упоминает «подтвердить через `ls i18n/messages`» — тоже уточнение, не TODO.

**Type consistency:** `getDayOfWeekInTz` в бэке возвращает 3-letter lowercase (`"sun"|"mon"...`), во фронте — number 0..6 (соответствует `Date.getDay()`). Разные типы сознательно: бэк сравнивает со строками в `weeklyHours.day`, фронт — с массивом по индексу. Оба имеют tests/сценарии использования внутри своих задач.

**Cross-repo coordination:** Task 12 (фронт шлёт tz) и Task 3 (бэк принимает) не зависят строго — если Task 3 упадёт первым, фронт без tz продолжит класть дефолт `DEFAULT_TIMEZONE`. Порядок безопасен.
