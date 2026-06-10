# Timezone Block 6 — Ownership model & defaults

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Зафиксировать ownership tz в системе. tz пользователя живёт в его личном `ScheduleTemplate` (`orgId = null`). tz организации — новое required-поле `Organization.timezone`. При регистрации и создании орги tz берётся из браузера, редактируется в профиле и настройках орги.

**Architecture:**
- Схема меняется: `Organization.settings.defaultTimezone` → `Organization.timezone` (корень, required).
- Миграция делает backfill из старого поля.
- Frontend при sign-up шлёт `timezone` с браузера в OAuth state (Google flow уже использует `state` для CSRF — расширяем его).
- Форма создания орги получает поле `timezone` с дефолтом `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- `createDefaultSchedule` принимает tz явно (при регистрации — из state; при вступлении в орг — из `Organization.timezone`).
- Никакого `User.timezone` — tz юзера читается из его personal `ScheduleTemplate`.

**Tech Stack:** Node 20 / Express / Mongoose / Next.js 15 / TypeScript.

**Spec:** [docs/superpowers/specs/2026-04-15-timezone-correctness-design.md](../specs/2026-04-15-timezone-correctness-design.md) — Block 6.

**Зависимости:** Block 5 — не блокирует, но реюз `TimezoneSelector` (из B1.3) ускоряет UI-таски.

---

### Task 1: Миграция `Organization.timezone`

**Files:**
- Create: `scripts/migrations/2026-04-16-org-timezone-backfill.mjs`
- Modify: `src/models/Organization.js`

- [ ] **Step 1: Write migration script:**

```js
#!/usr/bin/env node
import mongoose from "mongoose";
import "dotenv/config";

await mongoose.connect(process.env.MONGO_URI);

const Org = mongoose.connection.db.collection("organizations");

const res = await Org.updateMany(
  { timezone: { $exists: false } },
  [
    { $set: { timezone: { $ifNull: ["$settings.defaultTimezone", "Europe/Kyiv"] } } },
    { $unset: "settings.defaultTimezone" },
  ]
);

console.log(`Backfilled ${res.modifiedCount} orgs.`);
await mongoose.disconnect();
```

- [ ] **Step 2: Dry-run на dev БД**, проверить:

```bash
node scripts/migrations/2026-04-16-org-timezone-backfill.mjs
mongosh --eval 'db.organizations.findOne({}, {timezone:1, "settings.defaultTimezone":1})'
```

Ожидание: `timezone` заполнен, `settings.defaultTimezone` отсутствует.

- [ ] **Step 3: Update model** `src/models/Organization.js`:

```js
timezone: {
  type: String,
  required: true,
  validate: {
    validator: (v) => {
      try { Intl.supportedValuesOf("timeZone").includes(v); return !!v; } catch { return false; }
    },
    message: "Invalid IANA timezone",
  },
},
// удалить settings.defaultTimezone
```

Комментарий обновить: «IANA timezone организации. Source of truth для org-scoped ScheduleTemplate.»

- [ ] **Step 4: Commit**

```bash
git add scripts/migrations/2026-04-16-org-timezone-backfill.mjs src/models/Organization.js
git commit -m "feat(org): Organization.timezone в корне, required + миграция"
```

---

### Task 2: `createDefaultSchedule` принимает tz явно

**Files:**
- Modify: `src/services/scheduleServices.js:20-45`
- Test: `src/services/__tests__/scheduleServices.test.js`

- [ ] **Step 1: Write failing test:**

```js
it("throws when timezone is null and orgId is null", async () => {
  await expect(createDefaultSchedule("u1", null, null))
    .rejects.toThrow("timezone_required");
});

it("uses org.timezone when orgId passed", async () => {
  // mock getOrgById to return { timezone: "Europe/Berlin" }
  const tpl = await createDefaultSchedule("u1", "org1");
  expect(tpl.timezone).toBe("Europe/Berlin");
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement:**

```js
import { isValidTimezone } from "../shared/utils/timezone.js";
import { getOrgById } from "./orgServices.js";

const createDefaultSchedule = async (staffId, orgId = null, timezone = null) => {
  const resolvedTz = timezone
    || (orgId ? (await getOrgById(orgId))?.timezone : null);
  if (!resolvedTz || !isValidTimezone(resolvedTz)) {
    throw new Error("timezone_required");
  }
  return ScheduleTemplate.create({
    staffId, orgId,
    timezone: resolvedTz,
    weeklyHours: defaultWeeklyHours(),
    slotMode: "fixed",
    slotStepMin: 30,
  });
};
```

Хардкод `timezone: DEFAULT_TIMEZONE` убрать.

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add src/services/scheduleServices.js src/services/__tests__/scheduleServices.test.js
git commit -m "feat(schedule): createDefaultSchedule принимает tz явно, без DEFAULT_TIMEZONE fallback"
```

---

### Task 3: `rotateTemplate` без DEFAULT fallback

**Files:**
- Modify: `src/services/scheduleServices.js:48-70`

- [ ] **Step 1:**

```js
const rotateTemplate = async ({ staffId, orgId, locationId, weeklyHours, slotMode, slotStepMin, timezone }) => {
  if (!timezone || !isValidTimezone(timezone)) {
    throw new Error("timezone_required");
  }
  // ...остальной код, но без `timezone: timezone || DEFAULT_TIMEZONE`
  return ScheduleTemplate.create({ staffId, orgId, locationId, timezone, weeklyHours, slotMode, slotStepMin });
};
```

- [ ] **Step 2:** `scheduleController` уже валидирует (B1.2). Убедиться что 400-ошибка возвращается при пустой tz.

- [ ] **Step 3: Commit**

```bash
git add src/services/scheduleServices.js
git commit -m "refactor(schedule): rotateTemplate требует валидную tz, DEFAULT fallback удалён"
```

---

### Task 4: OAuth state хранит tz браузера

**Files:**
- Modify: `src/modules/auth/services/authServices.js` (`createOauthState`)
- Modify: `src/modules/auth/providers/google.js` (`buildAuthUrl`)
- Modify: `src/modules/auth/controller/authController.js` (callback)
- Frontend: `app/[locale]/login/page.tsx` (или где редирект на OAuth)

- [ ] **Step 1: Backend** — расширить `createOauthState` чтобы принимал `timezone`:

```js
const createOauthState = (timezone) => {
  const state = randomUUID();
  // сохраняем state+tz в cookie (или Redis) как JSON
  const payload = JSON.stringify({ state, timezone });
  return { state, cookieValue: Buffer.from(payload).toString("base64url") };
};

const validateOauthState = (cookieValue, receivedState) => {
  const { state, timezone } = JSON.parse(Buffer.from(cookieValue, "base64url").toString());
  if (state !== receivedState) throw new Error("invalid_state");
  return { timezone };
};
```

- [ ] **Step 2:** `authController.handleLogin(provider, req, res)`:

```js
const timezone = req.query.timezone;
if (!timezone || !isValidTimezone(timezone)) {
  return httpResponseError(res, new HttpError(400, "timezone_required"));
}
const { state, cookieValue } = createOauthState(timezone);
res.cookie("oauth_state", cookieValue, stateCookieOptions);
res.redirect(buildAuthUrl(state));
```

Callback:
```js
const { timezone } = validateOauthState(req.cookies.oauth_state, req.query.state);
// ... findOrCreateUser, создание personal schedule:
await createDefaultSchedule(newUser.id, null, timezone);
```

- [ ] **Step 3: Frontend** — страница логина формирует redirect-URL с `?timezone=<browser_tz>`:

```tsx
const onLogin = (provider: string) => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  window.location.href = `${API_URL}/auth/${provider}?timezone=${encodeURIComponent(tz)}`
}
```

- [ ] **Step 4: Test** — integration-тест полного flow с моком Google API.

- [ ] **Step 5: Manual smoke** — залогиниться в Chrome (`Europe/Kyiv`) и через VPN симулировать другую tz; убедиться что personal template создаётся с tz из браузера.

- [ ] **Step 6: Commit**

```bash
git add src/modules/auth/services/authServices.js src/modules/auth/controller/authController.js src/modules/auth/providers/google.js app/[locale]/login/page.tsx
git commit -m "feat(auth): tz браузера в OAuth state → personal ScheduleTemplate.timezone при регистрации"
```

---

### Task 5: `orgController` принимает tz при создании

**Files:**
- Modify: `src/controllers/orgController.js` (`handleCreateOrg`)
- Modify: `src/services/orgServices.js` (`createOrganization`)
- Test: `src/services/__tests__/orgServices.test.js`

- [ ] **Step 1: Write failing test:**

```js
it("rejects org creation without timezone", async () => {
  await expect(createOrganization({ ownerId: "u1", name: "X" }))
    .rejects.toThrow("timezone_required");
});

it("creates org with given timezone and first ScheduleTemplate inherits it", async () => {
  const org = await createOrganization({ ownerId: "u1", name: "X", timezone: "Europe/Berlin" });
  expect(org.timezone).toBe("Europe/Berlin");
  const tpl = await getActiveTemplate("u1", org.id);
  expect(tpl.timezone).toBe("Europe/Berlin");
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement:**

```js
const createOrganization = async ({ ownerId, name, timezone, ...rest }) => {
  if (!timezone || !isValidTimezone(timezone)) throw new Error("timezone_required");
  const org = await Org.create({ ownerId, name, timezone, ...rest });
  await createDefaultSchedule(ownerId, org.id);  // tz возьмётся из org.timezone
  return org;
};
```

Контроллер:
```js
const { name, timezone } = req.body;
const org = await createOrganization({ ownerId: req.user.id, name, timezone });
httpResponse(res, generalStatus.SUCCESS, toOrgDto(org));
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add src/controllers/orgController.js src/services/orgServices.js src/services/__tests__/orgServices.test.js
git commit -m "feat(org): создание орги требует timezone, первый шаблон наследует"
```

---

### Task 6: `TimezoneSelector` — переюзный компонент

**Files:**
- Create: `components/shared/TimezoneSelector.tsx`
- Modify: `components/staff-schedule/ScheduleViewTab.tsx` — переюз

- [ ] **Step 1: Extract** логику пикера из `ScheduleViewTab.tsx` в отдельный компонент:

```tsx
'use client'
import { Combobox } from '@/components/ui/combobox'

interface Props {
  value: string
  onChange: (tz: string) => void
  hint?: string
}

const TimezoneSelector = ({ value, onChange, hint }: Props) => {
  const options = Intl.supportedValuesOf('timeZone').map((tz) => ({ value: tz, label: tz }))
  return (
    <div>
      <Combobox options={options} value={value} onValueChange={onChange} />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}

export { TimezoneSelector }
```

- [ ] **Step 2: Update** `ScheduleViewTab.tsx` — использовать `<TimezoneSelector />` вместо inline-пикера.

- [ ] **Step 3: Commit**

```bash
git add components/shared/TimezoneSelector.tsx components/staff-schedule/ScheduleViewTab.tsx
git commit -m "refactor(ui): TimezoneSelector — переюзный компонент IANA-пикера"
```

---

### Task 7: Форма создания орги

**Files:**
- Modify: `app/[locale]/org/create/page.tsx` (или где форма — найти grep'ом)
- Modify: `lib/api-clients/orgApi.ts` (типы запроса)

- [ ] **Step 1: Добавить** поле `timezone` в форму:

```tsx
const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

// в JSX:
<div>
  <label className="text-sm">Часовий пояс</label>
  <TimezoneSelector
    value={timezone}
    onChange={setTimezone}
    hint="Визначено за вашим браузером. Змініть, якщо компанія працює в іншій часовій зоні."
  />
</div>
```

Submit шлёт `{ name, timezone }`.

- [ ] **Step 2: Обновить тип в API-клиенте** — `CreateOrgRequest` с полем `timezone: string`.

- [ ] **Step 3: Manual test** — создать оргу, проверить что personal `ScheduleTemplate.timezone` = выбранной tz.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/org/create/page.tsx lib/api-clients/orgApi.ts
git commit -m "feat(org-create): поле timezone в форме создания, дефолт из браузера"
```

---

### Task 8: Секция «Мій часовий пояс» в профиле

**Files:**
- Modify: `app/[locale]/profile/page.tsx` (или путь, где профиль)

- [ ] **Step 1: Добавить** секцию:

```tsx
const { data: personalSchedule } = usePersonalSchedule()
const [tz, setTz] = useState(personalSchedule?.timezone ?? '')

useEffect(() => { if (personalSchedule) setTz(personalSchedule.timezone) }, [personalSchedule])

const onSave = async () => {
  await updateScheduleTimezone(personalSchedule.id, tz)
  toast.success('Часовий пояс оновлено')
}

// JSX:
<section>
  <h3>Мій часовий пояс</h3>
  <TimezoneSelector value={tz} onChange={setTz} />
  <Button onClick={onSave} disabled={tz === personalSchedule?.timezone}>Зберегти</Button>
</section>
```

- [ ] **Step 2: API** — `updateScheduleTimezone` вызывает существующий `PATCH /api/schedule/:id` (часть `rotateTemplate`).

- [ ] **Step 3: Manual test** — сменить tz, проверить что личный календарь перерендерился.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/profile/page.tsx
git commit -m "feat(profile): редактирование tz личного расписания"
```

---

### Task 9: Секция «Часовий пояс організації» в настройках

**Files:**
- Modify: `app/[locale]/org/[orgSlug]/settings/page.tsx`
- Modify: `src/controllers/orgController.js` (`handleUpdateOrg` должен принимать tz)

- [ ] **Step 1: Backend PATCH `/api/org/:orgId`** принимает `timezone`:

```js
const handleUpdateOrg = async (req, res) => {
  const { timezone, ...rest } = req.body;
  if (timezone && !isValidTimezone(timezone)) return httpResponseError(res, new HttpError(400, "invalid_timezone"));
  const updated = await updateOrg(req.params.orgId, { ...rest, ...(timezone && { timezone }) });
  httpResponse(res, generalStatus.SUCCESS, toOrgDto(updated));
};
```

- [ ] **Step 2: Frontend:**

```tsx
const [tz, setTz] = useState(org.timezone)

const onSave = async () => {
  if (tz !== org.timezone) {
    const ok = confirm('Нові розклади будуть створюватись у новій tz. Існуючі не зміняться.')
    if (!ok) return
  }
  await updateOrg(org.id, { timezone: tz })
}

<section>
  <h3>Часовий пояс організації</h3>
  <TimezoneSelector value={tz} onChange={setTz} />
  <p className="text-xs text-muted-foreground">
    Використовується як дефолт для нових співробітників орги та для розрахунків, коли у співробітника немає власного шаблону.
  </p>
  <Button onClick={onSave} disabled={tz === org.timezone}>Зберегти</Button>
</section>
```

- [ ] **Step 3: Manual test** — сменить tz орги, проверить что существующие schedule templates не изменились, а новые (после добавления нового сотрудника) — да.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/org/[orgSlug]/settings/page.tsx src/controllers/orgController.js
git commit -m "feat(org-settings): редактирование tz организации + warning о наследии"
```

---

### Task 10: Чистка DEFAULT_TIMEZONE и старых fallback'ов

**Files:**
- Modify: `src/constants/schedule.js` (удалить экспорт `DEFAULT_TIMEZONE` или оставить только для seed/test)
- Modify: `src/scripts/seed.js` (если использует)
- Grep: `grep -rn DEFAULT_TIMEZONE src/` — все прочие места должны использовать `org.timezone` или брать явно от caller'а

- [ ] **Step 1:** Удалить все импорты `DEFAULT_TIMEZONE` кроме `seed.js` и тестов. Если grep что-то показал — каждое место разбираем вручную.

- [ ] **Step 2:** Запустить весь test-suite: `npm test`. Ожидание: pass.

- [ ] **Step 3:** Запустить `npm run lint:tz` (из Block 5 Task 15). Ожидание: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/constants/schedule.js src/scripts/seed.js
git commit -m "chore(tz): DEFAULT_TIMEZONE только для seed/тестов, production-код берёт tz из org/template"
```

---

## Self-review

**Spec coverage:**
- B6.1 (Org.timezone required + миграция) → Task 1 ✓
- B6.2 (Location.timezone optional) — не меняется, spec уже говорит «оставляем optional, не используем» ✓ (no-op)
- B6.3 (registration: tz в state) → Task 4 ✓
- B6.4 (frontend OAuth state подход) → Task 4 ✓
- B6.5 (org create с tz) → Task 5 + Task 7 ✓
- B6.6 (createDefaultSchedule принимает tz) → Task 2 ✓
- B6.7 (rotateTemplate без fallback) → Task 3 ✓
- B6.8 (UI «Мій часовий пояс») → Task 8 ✓
- B6.9 (UI «Часовий пояс організації») → Task 9 ✓
- B6.10 (миграция существующих юзеров — оставляем как есть) → покрыто Task 1 (org backfill); user'ские personal templates уже имеют tz (required в модели), трогать не нужно ✓

**Placeholder scan:** `isValidTimezone` существует (коммит `4029278`). `getOrgById` — есть в `orgServices.js` (используется репозиторием). `usePersonalSchedule` — проверить существование; если нет — добавить как подзадачу в Task 8 (создать hook).

**Type consistency:** `Organization.timezone` — `String`, required везде. `createDefaultSchedule(staffId, orgId?, timezone?)` — сигнатура консистентна в Task 2, 4, 5.

**Deploy order** (важно для production):
1. Deploy Task 1 (backfill + модель required) **одной атомарной выкладкой**, иначе после добавления `required` старые записи станут невалидными.
2. Task 2–3 можно выкатить позже.
3. Task 4–9 — фронтенд + бек идут парой.
4. Task 10 — финальная чистка.
