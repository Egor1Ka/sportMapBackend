# Timezone Block 5 — Close remaining tz leaks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть все ~15 оставшихся мест, где browser или server tz протекает в бизнес-логику или рендер времени. Симптом, который это фиксит: панель «Запис створено» показывает UTC вместо tz шаблона.

**Architecture:** Единый helper `wallClockInTz(iso, tz)` на фронте и бэке, через который проходит любое чтение wall-clock времени из Date. Остальные задачи — перевод существующих call-site'ов на helper или на явно переданную tz. Тесты — unit на helper + smoke-тесты на фиксящие места.

**Tech Stack:** Node 20 / Express / Mongoose (backend), Next.js 15 / TypeScript / Vitest (frontend).

**Spec:** [docs/superpowers/specs/2026-04-15-timezone-correctness-design.md](../specs/2026-04-15-timezone-correctness-design.md) — Block 5.

---

### Task 1: `wallClockInTz` helper (frontend)

**Files:**
- Modify: `lib/calendar/tz.ts`
- Test: `lib/calendar/tz.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import { wallClockInTz } from './tz'

describe('wallClockInTz', () => {
  it('returns Kyiv wall-clock for UTC iso in DST', () => {
    const wc = wallClockInTz('2026-04-18T06:00:00Z', 'Europe/Kyiv')
    expect(wc).toEqual({ year: 2026, month: 4, day: 18, hour: 9, minute: 0, dayOfWeek: 6 })
  })
  it('returns Berlin wall-clock for same iso', () => {
    const wc = wallClockInTz('2026-04-18T06:00:00Z', 'Europe/Berlin')
    expect(wc.hour).toBe(8)
  })
  it('handles midnight wraparound', () => {
    const wc = wallClockInTz('2026-04-18T23:30:00Z', 'Europe/Kyiv')
    expect(wc).toMatchObject({ day: 19, hour: 2, minute: 30 })
  })
})
```

- [ ] **Step 2: Run test, verify FAIL** — `npx vitest run lib/calendar/tz.test.ts`

- [ ] **Step 3: Implement**

В `lib/calendar/tz.ts` добавить:

```ts
interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  dayOfWeek: number
}

const getPart = (parts: Intl.DateTimeFormatPart[], type: string): number => {
  const p = parts.find((x) => x.type === type)
  return p ? parseInt(p.value, 10) : 0
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

const wallClockInTz = (iso: string, timezone: string): WallClock => {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
    hour12: false,
  }).formatToParts(d)
  const weekdayRaw = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  return {
    year: getPart(parts, 'year'),
    month: getPart(parts, 'month'),
    day: getPart(parts, 'day'),
    hour: getPart(parts, 'hour') % 24,
    minute: getPart(parts, 'minute'),
    dayOfWeek: WEEKDAY_MAP[weekdayRaw] ?? 0,
  }
}

export { wallClockInTz }
export type { WallClock }
```

- [ ] **Step 4: Run test, verify PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/tz.ts lib/calendar/tz.test.ts
git commit -m "feat(tz): add wallClockInTz helper для detershminированного разбора ISO в tz"
```

---

### Task 2: `wallClockInTz` helper (backend)

**Files:**
- Modify: `src/shared/utils/timezone.js`
- Test: `src/shared/utils/__tests__/timezone.test.js` (создать, если нет)

- [ ] **Step 1: Write failing test**

```js
import { describe, it, expect } from "vitest";
import { wallClockInTz } from "../timezone.js";

describe("wallClockInTz", () => {
  it("Kyiv DST", () => {
    expect(wallClockInTz("2026-04-18T06:00:00Z", "Europe/Kyiv"))
      .toEqual({ year: 2026, month: 4, day: 18, hour: 9, minute: 0, dayOfWeek: 6 });
  });
});
```

- [ ] **Step 2: Run FAIL** — `npm test -- src/shared/utils/__tests__/timezone.test.js`

- [ ] **Step 3: Implement** — идентичная функция из Task 1, но в JS (ESM). Экспортировать именованно.

- [ ] **Step 4: Run PASS**

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/timezone.js src/shared/utils/__tests__/timezone.test.js
git commit -m "feat(tz): backend wallClockInTz helper (зеркало frontend)"
```

---

### Task 3: Фикс `formatLocalTime` — баг со скриншота

**Files:**
- Modify: `components/booking/BookingPanelParts.tsx`
- Test: `components/booking/BookingPanelParts.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { ConfirmedState } from './BookingPanelParts'

const booking = {
  bookingId: 'b1', eventTypeId: 'e1', eventTypeName: 'Test',
  startAt: '2026-04-18T06:00:00Z', endAt: '2026-04-18T07:00:00Z',
  timezone: 'Europe/Kyiv', locationId: null, cancelToken: 't',
}

it('shows 09:00 Kyiv, not 06:00 UTC', () => {
  render(<ConfirmedState confirmedBooking={booking} onCancel={() => {}} />)
  expect(screen.getByText('09:00')).toBeInTheDocument()
  expect(screen.queryByText('06:00')).toBeNull()
})
```

- [ ] **Step 2: Run FAIL**

- [ ] **Step 3: Implement**

В `BookingPanelParts.tsx`:

```tsx
import { wallClockInTz } from '@/lib/calendar/tz'

const pad2 = (n: number): string => String(n).padStart(2, '0')

const formatLocalTime = (iso: string, timezone: string): string => {
  const wc = wallClockInTz(iso, timezone)
  return `${pad2(wc.hour)}:${pad2(wc.minute)}`
}
```

В `ConfirmedState`:

```tsx
const startTime = formatLocalTime(confirmedBooking.startAt, confirmedBooking.timezone)
const endTime = formatLocalTime(confirmedBooking.endAt, confirmedBooking.timezone)
```

- [ ] **Step 4: Run PASS + manual test** — воспроизвести сценарий из скриншота: создать бронь, убедиться что правая панель показывает 09:00.

- [ ] **Step 5: Commit**

```bash
git add components/booking/BookingPanelParts.tsx components/booking/BookingPanelParts.test.tsx
git commit -m "fix(booking): ConfirmedState показывает время в tz шаблона, не UTC"
```

---

### Task 4: `timeToMinFromISO` — убрать fallback

**Files:**
- Modify: `lib/booking-utils.ts`

- [ ] **Step 1** — сделать `timezone` обязательным:

```ts
const timeToMinFromISO = (iso: string, timezone: string): number => {
  const wc = wallClockInTz(iso, timezone)
  return wc.hour * 60 + wc.minute
}
```

Удалить ветку `if (!timezone)`. Импорт `wallClockInTz` из `@/lib/calendar/tz`.

- [ ] **Step 2: tsc** — `npx tsc --noEmit`. Все call-site'ы уже передают tz (B3.3 сделана). Если tsc ругается — поправить.

- [ ] **Step 3: Commit**

```bash
git add lib/booking-utils.ts
git commit -m "refactor(tz): timeToMinFromISO требует timezone, fallback удалён"
```

---

### Task 5: `getNowMinForDate` + `CalendarCore` current-minute

**Files:**
- Modify: `lib/calendar/utils.ts:110-116`
- Modify: `lib/calendar/CalendarCore.tsx:107`

- [ ] **Step 1: Update** `utils.ts`:

```ts
const getNowMinForDate = (dateStr: string, timezone: string): number => {
  const today = getTodayStrInTz(timezone)
  if (dateStr < today) return Number.POSITIVE_INFINITY
  if (dateStr > today) return 0
  const wc = wallClockInTz(new Date().toISOString(), timezone)
  return wc.hour * 60 + wc.minute
}
```

Добавить `getTodayStrInTz`:

```ts
const getTodayStrInTz = (timezone: string): string => {
  const wc = wallClockInTz(new Date().toISOString(), timezone)
  return `${wc.year}-${String(wc.month).padStart(2, '0')}-${String(wc.day).padStart(2, '0')}`
}
```

Старый `getTodayStr()` удалить (или оставить и вызывать `getTodayStrInTz(Intl.DateTimeFormat().resolvedOptions().timeZone)` — только если есть call-site без tz, которых быть не должно).

- [ ] **Step 2: Update** `CalendarCore.tsx:107`:

```ts
// был: return now.getHours() * 60 + now.getMinutes()
const wc = wallClockInTz(new Date().toISOString(), timezone)
return wc.hour * 60 + wc.minute
```

`timezone` проп уже есть в компоненте (strategy pattern).

- [ ] **Step 3: tsc + прогнать все call-site'ы `getNowMinForDate`**. Передать tz шаблона везде.

- [ ] **Step 4: Commit**

```bash
git add lib/calendar/utils.ts lib/calendar/CalendarCore.tsx
git commit -m "fix(calendar): getNowMinForDate и current-minute считаются в tz шаблона"
```

---

### Task 6: Строковая арифметика дат в `calendar/utils.ts`

**Files:**
- Modify: `lib/calendar/utils.ts` (секции `formatDateISO`, `formatWeekRange`, `formatMonth`, `getWeekStart`, `createWeekDate`, `getMonthGrid`, `addDays`, `addMonths`)
- Test: `lib/calendar/utils.test.ts` (создать)

- [ ] **Step 1: Write failing tests** для каждой функции — проверить что они не зависят от browser tz (мокнуть `process.env.TZ = "America/Los_Angeles"` в `beforeAll`):

```ts
import { describe, it, expect } from 'vitest'
import { addDays, addMonths, getMonthGrid, formatDateISO } from './utils'

describe('date arithmetic is tz-independent', () => {
  it('addDays on boundary', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01')
    expect(addDays('2026-04-01', -1)).toBe('2026-03-31')
  })
  it('addMonths', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })
  it('getMonthGrid spans full month', () => {
    const grid = getMonthGrid('2026-04-15', 'Europe/Kyiv')
    const flat = grid.flat().filter(Boolean)
    expect(flat[0]).toBe('2026-04-01')
    expect(flat[flat.length - 1]).toBe('2026-04-30')
  })
})
```

- [ ] **Step 2: Run FAIL** (хотя бы на одном из кейсов — в зависимости от системной tz CI)

- [ ] **Step 3: Rewrite functions на строковую арифметику + `Date.UTC`:**

```ts
const parseYMD = (str: string): [number, number, number] => {
  const [y, m, d] = str.split('-').map(Number)
  return [y, m, d]
}

const formatYMD = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const addDays = (dateStr: string, days: number): string => {
  const [y, m, d] = parseYMD(dateStr)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return formatYMD(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
}

const addMonths = (dateStr: string, months: number): string => {
  const [y, m, d] = parseYMD(dateStr)
  const utc = new Date(Date.UTC(y, m - 1 + months, d))
  return formatYMD(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
}

const getMonthGrid = (dateStr: string, timezone: string): (string | null)[][] => {
  const [y, m] = parseYMD(dateStr)
  const firstOfMonth = formatYMD(y, m, 1)
  const firstDayWeekday = (getDayOfWeekInTz(firstOfMonth, timezone) + 6) % 7
  const totalDays = new Date(Date.UTC(y, m, 0)).getUTCDate() // last day of month
  const totalCells = firstDayWeekday + totalDays
  const rowCount = Math.ceil(totalCells / 7)

  const cellToDate = (_: unknown, i: number): string | null => {
    const dayNum = i - firstDayWeekday + 1
    if (dayNum < 1 || dayNum > totalDays) return null
    return formatYMD(y, m, dayNum)
  }
  const allCells = Array.from({ length: rowCount * 7 }, cellToDate)
  const toRow = (_: unknown, rowIdx: number) => allCells.slice(rowIdx * 7, rowIdx * 7 + 7)
  return Array.from({ length: rowCount }, toRow)
}

const getWeekStart = (dateStr: string, timezone: string): string => {
  const dow = getDayOfWeekInTz(dateStr, timezone)
  const diff = (dow + 6) % 7
  return addDays(dateStr, -diff)
}

const createWeekDate = (mondayStr: string) =>
  (_: unknown, i: number): string => addDays(mondayStr, i)

const getWeekDates = (dateStr: string, timezone: string): string[] => {
  const monday = getWeekStart(dateStr, timezone)
  return Array.from({ length: 7 }, createWeekDate(monday))
}
```

Аналогично переписать `formatDateLocale`, `formatWeekRange`, `formatMonth` — принимать `dateStr` (строку), разбирать через `parseYMD`, формировать отображение через `locale.days[getDayOfWeekInTz(...)]` и `locale.months[m-1]`.

- [ ] **Step 4: Run PASS**

- [ ] **Step 5: Обновить call-site'ы** (`CalendarCore.tsx`, `useBookingActions.ts` и др.) — проверить `tsc`.

- [ ] **Step 6: Commit**

```bash
git add lib/calendar/utils.ts lib/calendar/utils.test.ts
git commit -m "refactor(calendar): арифметика дат на строках YYYY-MM-DD, tz-independent"
```

---

### Task 7: `cellDate.getDate()` → split

**Files:**
- Modify: `lib/calendar/CalendarCore.tsx:657`

- [ ] **Step 1:**

```ts
// был: const dayNum = new Date(cellDate + 'T00:00:00').getDate()
const dayNum = parseInt(cellDate.split('-')[2], 10)
```

- [ ] **Step 2: Commit**

```bash
git add lib/calendar/CalendarCore.tsx
git commit -m "fix(calendar): day-number берём из YYYY-MM-DD строки напрямую"
```

---

### Task 8: `BookingDetailsPanel` / `BookingDetailPanel`

**Files:**
- Modify: `components/booking/BookingDetailsPanel.tsx:60-85` (проп `scheduleTimezone`)
- Modify: `components/booking/BookingDetailPanel.tsx:85-95`

- [ ] **Step 1: Update** `BookingDetailsPanel.tsx`:

```tsx
interface Props {
  // ...existing
  scheduleTimezone: string
}

const formatTime = (iso: string, timeZone: string): string =>
  new Date(iso).toLocaleTimeString('uk-UA', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })

const formatDate = (iso: string, timeZone: string): string =>
  new Date(iso).toLocaleDateString('uk-UA', { timeZone, day: 'numeric', month: 'long', year: 'numeric' })

// использовать formatTime(startAt, scheduleTimezone)
```

- [ ] **Step 2: Обновить call-site'ы** — передать `scheduleTimezone` пропом. Пройтись по `tsc`.

- [ ] **Step 3: Update** `BookingDetailPanel.tsx` идентично (проп `timezone`).

- [ ] **Step 4: Commit**

```bash
git add components/booking/BookingDetailsPanel.tsx components/booking/BookingDetailPanel.tsx
git commit -m "fix(booking): панели деталей форматируют время в tz шаблона"
```

---

### Task 9: Staff-schedule списки

**Files:**
- Modify: `components/staff-schedule/BookingListItem.tsx:27`
- Modify: `components/staff-schedule/BookingDateGroup.tsx:13`
- Modify: `components/staff-schedule/OverrideListItem.tsx:20`

- [ ] **Step 1:** Каждому компоненту добавить проп `timezone: string`. Передать в `toLocaleTimeString/DateString({ timeZone: timezone, ... })`.

Родительский компонент (`BookingsTab.tsx`) прокидывает `schedule.timezone` детям.

- [ ] **Step 2: tsc + визуальный smoke-тест** — открыть список броней, сравнить время с календарём.

- [ ] **Step 3: Commit**

```bash
git add components/staff-schedule/BookingListItem.tsx components/staff-schedule/BookingDateGroup.tsx components/staff-schedule/OverrideListItem.tsx
git commit -m "fix(staff-schedule): списки показывают время в tz расписания"
```

---

### Task 10: `BookingsTab` — неделя в tz

**Files:**
- Modify: `components/staff-schedule/BookingsTab.tsx:30-45, 60-65`

- [ ] **Step 1:**

```tsx
import { getWeekStart, addDays, formatDateISO } from '@/lib/calendar/utils'

const computeWeekRange = (offset: number, timezone: string): { from: string; to: string } => {
  const todayStr = getTodayStrInTz(timezone)
  const baseMonday = getWeekStart(todayStr, timezone)
  const monday = addDays(baseMonday, offset * 7)
  const sunday = addDays(monday, 6)
  return { from: monday, to: sunday }
}
```

Убрать `new Date()`, `monday.setDate(...)`, `sunday.setDate(...)`.

`toLocaleDateString` на строке 62 — с `{ timeZone: schedule.timezone }`.

- [ ] **Step 2: Commit**

```bash
git add components/staff-schedule/BookingsTab.tsx
git commit -m "fix(staff-schedule): начало/конец недели в tz расписания"
```

---

### Task 11: `useBookingActions` — убрать fallback

**Files:**
- Modify: `lib/calendar/hooks/useBookingActions.ts:50-60`

- [ ] **Step 1:** Убрать `Intl.DateTimeFormat().resolvedOptions().timeZone`. Хук принимает `timezone` параметром от caller'а. tsc выявит не-передающие.

- [ ] **Step 2: Commit**

```bash
git add lib/calendar/hooks/useBookingActions.ts
git commit -m "refactor(tz): useBookingActions требует timezone, browser fallback удалён"
```

---

### Task 12: `helpers.ts` / `useFindNearestSlots` / `SlotListView`

**Files:**
- Modify: `lib/calendar/hooks/helpers.ts:15-35`
- Modify: `lib/calendar/hooks/useFindNearestSlots.ts:55-70`
- Modify: `components/booking/SlotListView.tsx:150-165`

- [ ] **Step 1:** Во всех трёх — заменить `new Date(...).setDate/getDate/getFullYear/getMonth` на комбинации `addDays` / `parseYMD` / `formatYMD` из Task 6. Там где итерация нужна от текущей даты — передавать `timezone`.

Пример для `helpers.ts`:

```ts
const computeRangeEnd = (fromStr: string): string => addDays(fromStr, LIST_VIEW_DAYS)
```

`SlotListView` формирование строки `YYYY-MM-DD` из Date → через `wallClockInTz(iso, timezone)` + `formatYMD`.

- [ ] **Step 2: tsc, manual test** — открыть SlotListView.

- [ ] **Step 3: Commit**

```bash
git add lib/calendar/hooks/helpers.ts lib/calendar/hooks/useFindNearestSlots.ts components/booking/SlotListView.tsx
git commit -m "fix(calendar): hooks и SlotListView — даты через строковую арифметику"
```

---

### Task 13: Backend `orgServices.setHours`

**Files:**
- Modify: `src/services/orgServices.js:15-30`
- Test: `src/services/__tests__/orgServices.test.js`

- [ ] **Step 1: Write failing test** (mock `process.env.TZ = "America/Los_Angeles"`):

```js
import { getDayRange } from "../orgServices.js";

it("day range anchored to Kyiv не зависит от server tz", () => {
  const { start, end } = getDayRange("2026-04-18", "Europe/Kyiv");
  expect(start.toISOString()).toBe("2026-04-17T21:00:00.000Z");
  expect(end.toISOString()).toBe("2026-04-18T20:59:59.999Z");
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3:** Рефакторинг функции, которая сейчас делает `setHours`:

```js
import { parseWallClockToUtc } from "../shared/utils/timezone.js";

const getDayRange = (dateStr, timezone) => {
  const start = parseWallClockToUtc(dateStr, "00:00", timezone);
  const end = parseWallClockToUtc(dateStr, "23:59:59.999", timezone);
  return { start, end };
};
```

Call-site'ы принимают `timezone` явно — передать tz орги (из `Organization.timezone`) или из template.

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add src/services/orgServices.js src/services/__tests__/orgServices.test.js
git commit -m "fix(org): границы дня через parseWallClockToUtc, без setHours"
```

---

### Task 14: Backend `scheduleServices` «сьогодні»

**Files:**
- Modify: `src/controllers/scheduleController.js:15-25`
- Modify: `src/services/scheduleServices.js:20-100`
- Test: `src/services/__tests__/scheduleServices.test.js`

- [ ] **Step 1: Write failing test** на функцию вычисления «сегодня/вчера» в tz. (Определить какую именно функцию — посмотреть строки 25, 44, 50, 90 и выделить.)

- [ ] **Step 2: Implement** — заменить `today.setHours(0,0,0,0)` и `d.setDate(d.getDate()-1)` на:

```js
import { wallClockInTz } from "../shared/utils/timezone.js";

const todayInTz = (timezone) => {
  const wc = wallClockInTz(new Date().toISOString(), timezone);
  return `${wc.year}-${String(wc.month).padStart(2, '0')}-${String(wc.day).padStart(2, '0')}`;
};

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
};
```

Все 4 места перевести. Функции положить в `src/shared/utils/timezone.js` чтобы переиспользовать.

- [ ] **Step 3: PASS + integration** — запустить `billing.test.js` / `booking.test.js` паттерн, убедиться что ничего не сломалось.

- [ ] **Step 4: Commit**

```bash
git add src/controllers/scheduleController.js src/services/scheduleServices.js src/shared/utils/timezone.js src/services/__tests__/scheduleServices.test.js
git commit -m "fix(schedule): todayInTz и addDays вместо setHours/setDate, tz-independent"
```

---

### Task 15: CI-guard `scripts/check-tz.mjs`

**Files:**
- Create: `scripts/check-tz.mjs` (в обеих репах)
- Modify: `package.json` (обе репы) — script `"lint:tz"`
- Modify: `.husky/pre-commit` или `lefthook.yml`

- [ ] **Step 1: Write the script:**

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BAD_PATTERNS = [
  { re: /\.getHours\(\)/g, msg: "getHours() без timezone" },
  { re: /\.getMinutes\(\)/g, msg: "getMinutes() без timezone" },
  { re: /\.getDate\(\)/g, msg: "getDate() без timezone" },
  { re: /\.getDay\(\)/g, msg: "getDay() — используй getDayOfWeekInTz" },
  { re: /\.getMonth\(\)/g, msg: "getMonth() без timezone" },
  { re: /\.getFullYear\(\)/g, msg: "getFullYear() без timezone" },
  { re: /\.setHours\(/g, msg: "setHours() — используй parseWallClockToUtc" },
  { re: /\.setDate\(/g, msg: "setDate() — используй addDays(string)" },
  { re: /\.setMonth\(/g, msg: "setMonth() — используй addMonths(string)" },
  { re: /toLocaleString\s*\(\s*[^,)]+\s*\)/g, msg: "toLocaleString без timeZone" },
  { re: /toLocaleTimeString\s*\(\s*\[?[^,)]*\]?\s*\)/g, msg: "toLocaleTimeString без timeZone" },
  { re: /toLocaleDateString\s*\(\s*[^,)]*\s*\)/g, msg: "toLocaleDateString без timeZone" },
];

const ROOTS = process.argv.slice(2);
if (ROOTS.length === 0) { console.error("pass roots as args"); process.exit(2); }

const SKIP = /node_modules|\.next|dist|build|\.test\./;
const EXT = /\.(ts|tsx|js|mjs|jsx)$/;

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (SKIP.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (EXT.test(p)) out.push(p);
  }
  return out;
};

let errors = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const txt = readFileSync(file, "utf8");
    txt.split("\n").forEach((line, i) => {
      if (/tz-ok:/.test(line)) return;
      for (const { re, msg } of BAD_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(line)) {
          console.error(`${file}:${i + 1}  ${msg}`);
          console.error(`    ${line.trim()}`);
          errors++;
        }
      }
    });
  }
}
process.exit(errors === 0 ? 0 : 1);
```

- [ ] **Step 2: Update `package.json`:**

Backend:
```json
"scripts": { "lint:tz": "node scripts/check-tz.mjs src" }
```

Frontend:
```json
"scripts": { "lint:tz": "node scripts/check-tz.mjs lib components app hooks" }
```

- [ ] **Step 3: Запустить** `npm run lint:tz` в обеих репах. Ожидание: 0 errors после предыдущих тасков. Если остались — пометить исключения `// tz-ok: <reason>` там, где чтение UTC-clock легально (например, `slotServices.js:19` — ручной расчёт с `tzOffset`).

- [ ] **Step 4: Hook** — добавить `npm run lint:tz` в pre-commit + в GitHub Actions.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-tz.mjs package.json .husky/pre-commit
git commit -m "chore(tz): CI-guard против getHours/setHours/toLocaleString без timeZone"
```

---

## Self-review

**Spec coverage:**
- B5.1 → Task 3 ✓
- B5.2 → Task 4 ✓
- B5.3 → Task 5 ✓
- B5.4 → Task 6 ✓
- B5.5 → Task 7 ✓
- B5.6 → Task 8 ✓
- B5.7 → Task 8 ✓
- B5.8 → Task 9 ✓
- B5.9 → Task 10 ✓
- B5.10 → Task 11 ✓
- B5.11 → Task 12 ✓
- B5.12 → Task 13 ✓
- B5.13 → Task 14 ✓
- B5.14 → Task 1 + Task 2 ✓
- B5.15 → Task 15 ✓

**Placeholder scan:** функции, которые упомянуты (`parseWallClockToUtc`, `getDayOfWeekInTz`) — существуют (см. `src/shared/utils/timezone.js` и `lib/calendar/tz.ts`). `WallClock`/`wallClockInTz` создаются в Task 1-2. `todayInTz`/`addDays` backend создаются в Task 14. `formatYMD`/`parseYMD` создаются в Task 6.

**Type consistency:** `wallClockInTz` везде возвращает `{year, month, day, hour, minute, dayOfWeek}`. `addDays(string, number): string` консистентно.
