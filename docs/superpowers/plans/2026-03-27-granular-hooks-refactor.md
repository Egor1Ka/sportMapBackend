# Granular Hooks Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `useEffect` + `forceReload` pattern in `OrgCalendarPage` with 3 granular custom hooks (`useOrgInfo`, `useStaffSchedule`, `useStaffBookings`).

**Architecture:** Each hook owns one data domain, fetches independently, and uses stale-while-revalidate (loading spinner only on first fetch). Only `useStaffBookings` exposes a `reloadBookings()` function for post-mutation refresh.

**Tech Stack:** React hooks, TypeScript, existing `booking-api-client.ts` API layer

**Working directory:** `/Users/egorzozula/Desktop/Slotix-fronted/Slotix-fronted/`

---

## File Structure

```
lib/calendar/hooks/
  helpers.ts              — CREATE: pure helper functions shared across hooks
  useOrgInfo.ts           — CREATE: hook for org + staffList
  useStaffSchedule.ts     — CREATE: hook for eventTypes + schedule
  useStaffBookings.ts     — CREATE: hook for bookings + reloadBookings
  index.ts                — CREATE: re-exports

lib/calendar/index.ts     — MODIFY: add hook re-exports

components/booking/OrgCalendarPage.tsx — MODIFY: replace monolithic useEffect with hooks
```

---

### Task 1: Create helper functions

**Files:**
- Create: `lib/calendar/hooks/helpers.ts`

- [ ] **Step 1: Create `helpers.ts` with all pure functions**

```ts
import type { OrgStaffMember } from '@/services/configs/booking.types'
import type { ViewMode } from '../types'
import { formatDateISO, getWeekDates } from '../utils'

const getFirstStaffId = (staffList: OrgStaffMember[] | null): string | null => {
	if (!staffList || !staffList[0]) return null
	return staffList[0].id
}

const filterByStaffId = (staffId: string) => (staff: OrgStaffMember): boolean =>
	staff.id === staffId

const getStaffToLoad = (
	staffList: OrgStaffMember[],
	selectedStaffId: string | null,
	behavior: string,
): OrgStaffMember[] => {
	if (!selectedStaffId || behavior !== 'select-one') return staffList
	return staffList.filter(filterByStaffId(selectedStaffId))
}

interface DateRange {
	from: string
	to: string
}

const computeDateRange = (dateStr: string, view: ViewMode): DateRange => {
	if (view === 'week') {
		const weekDates = getWeekDates(dateStr)
		return { from: weekDates[0], to: weekDates[6] }
	}
	if (view === 'month') {
		const d = new Date(dateStr + 'T00:00:00')
		const year = d.getFullYear()
		const month = d.getMonth()
		const firstDay = formatDateISO(new Date(year, month, 1))
		const lastDay = formatDateISO(new Date(year, month + 1, 0))
		return { from: firstDay, to: lastDay }
	}
	return { from: dateStr, to: dateStr }
}

interface LoadedRange {
	from: string
	to: string
	view: string
	staffKey: string
}

const isWithinLoadedRange = (
	loaded: LoadedRange | null,
	dateStr: string,
	view: ViewMode,
	staffKey: string,
): boolean => {
	if (!loaded) return false
	if (loaded.view !== view) return false
	if (loaded.staffKey !== staffKey) return false
	return dateStr >= loaded.from && dateStr <= loaded.to
}

const buildStaffKey = (staffIds: string[]): string => staffIds.join(',')

const extractStaffIds = (staff: OrgStaffMember[]): string[] => {
	const toId = (s: OrgStaffMember): string => s.id
	return staff.map(toId)
}

export type { DateRange, LoadedRange }
export {
	getFirstStaffId,
	filterByStaffId,
	getStaffToLoad,
	computeDateRange,
	isWithinLoadedRange,
	buildStaffKey,
	extractStaffIds,
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/calendar/hooks/helpers.ts
git commit -m "feat(calendar): add pure helper functions for granular hooks"
```

---

### Task 2: Create `useOrgInfo` hook

**Files:**
- Create: `lib/calendar/hooks/useOrgInfo.ts`

- [ ] **Step 1: Create `useOrgInfo.ts`**

```ts
'use client'

import { useState, useEffect, useRef } from 'react'
import { orgApi } from '@/lib/booking-api-client'
import type { OrgByIdResponse, OrgStaffMember } from '@/services/configs/booking.types'

interface UseOrgInfoResult {
	org: OrgByIdResponse | null
	staffList: OrgStaffMember[]
	loading: boolean
	error: string | null
}

const useOrgInfo = (orgSlug: string): UseOrgInfoResult => {
	const [org, setOrg] = useState<OrgByIdResponse | null>(null)
	const [staffList, setStaffList] = useState<OrgStaffMember[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const loadedSlugRef = useRef<string | null>(null)

	useEffect(() => {
		if (loadedSlugRef.current === orgSlug) return

		const loadOrg = async () => {
			const isInitialLoad = org === null
			if (isInitialLoad) setLoading(true)
			setError(null)

			try {
				const [orgData, staff] = await Promise.all([
					orgApi.getById(orgSlug),
					orgApi.getStaff(orgSlug),
				])
				setOrg(orgData)
				setStaffList(staff)
				loadedSlugRef.current = orgSlug
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load organization'
				setError(message)
			} finally {
				setLoading(false)
			}
		}

		loadOrg()
	}, [orgSlug])

	return { org, staffList, loading, error }
}

export type { UseOrgInfoResult }
export { useOrgInfo }
```

- [ ] **Step 2: Commit**

```bash
git add lib/calendar/hooks/useOrgInfo.ts
git commit -m "feat(calendar): add useOrgInfo hook"
```

---

### Task 3: Create `useStaffSchedule` hook

**Files:**
- Create: `lib/calendar/hooks/useStaffSchedule.ts`

- [ ] **Step 1: Create `useStaffSchedule.ts`**

```ts
'use client'

import { useState, useEffect, useRef } from 'react'
import { eventTypeApi, scheduleApi } from '@/lib/booking-api-client'
import type { EventType, ScheduleTemplate } from '@/services/configs/booking.types'

interface UseStaffScheduleResult {
	eventTypes: EventType[]
	schedule: ScheduleTemplate | null
	loading: boolean
	error: string | null
}

const useStaffSchedule = (staffId: string | null): UseStaffScheduleResult => {
	const [eventTypes, setEventTypes] = useState<EventType[]>([])
	const [schedule, setSchedule] = useState<ScheduleTemplate | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const loadedStaffIdRef = useRef<string | null>(null)

	useEffect(() => {
		if (!staffId) {
			setEventTypes([])
			setSchedule(null)
			setLoading(false)
			return
		}

		if (loadedStaffIdRef.current === staffId) return

		const loadSchedule = async () => {
			const isInitialLoad = eventTypes.length === 0 && schedule === null
			if (isInitialLoad) setLoading(true)
			setError(null)

			try {
				const [et, sc] = await Promise.all([
					eventTypeApi.getByStaff(staffId),
					scheduleApi.getTemplate(staffId).catch(() => null),
				])
				setEventTypes(et)
				setSchedule(sc)
				loadedStaffIdRef.current = staffId
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load schedule'
				setError(message)
			} finally {
				setLoading(false)
			}
		}

		loadSchedule()
	}, [staffId])

	return { eventTypes, schedule, loading, error }
}

export type { UseStaffScheduleResult }
export { useStaffSchedule }
```

- [ ] **Step 2: Commit**

```bash
git add lib/calendar/hooks/useStaffSchedule.ts
git commit -m "feat(calendar): add useStaffSchedule hook"
```

---

### Task 4: Create `useStaffBookings` hook

**Files:**
- Create: `lib/calendar/hooks/useStaffBookings.ts`

- [ ] **Step 1: Create `useStaffBookings.ts`**

```ts
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { bookingApi } from '@/lib/booking-api-client'
import { toCalendarDisplayBooking } from '@/lib/booking-utils'
import type { OrgStaffMember, EventType, CalendarDisplayBooking } from '@/services/configs/booking.types'
import type { ViewMode } from '../types'
import {
	computeDateRange,
	isWithinLoadedRange,
	buildStaffKey,
	extractStaffIds,
	type LoadedRange,
} from './helpers'

interface UseStaffBookingsResult {
	bookings: CalendarDisplayBooking[]
	reloadBookings: () => void
	loading: boolean
	error: string | null
}

const useStaffBookings = (
	staffToLoad: OrgStaffMember[],
	dateStr: string,
	view: ViewMode,
	eventTypes: EventType[],
): UseStaffBookingsResult => {
	const [bookings, setBookings] = useState<CalendarDisplayBooking[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const loadedRangeRef = useRef<LoadedRange | null>(null)
	const [reloadTick, setReloadTick] = useState(0)

	const reloadBookings = useCallback(() => {
		loadedRangeRef.current = null
		setReloadTick((n) => n + 1)
	}, [])

	useEffect(() => {
		if (staffToLoad.length === 0 || eventTypes.length === 0) {
			setBookings([])
			setLoading(false)
			return
		}

		const staffIds = extractStaffIds(staffToLoad)
		const staffKey = buildStaffKey(staffIds)
		const range = computeDateRange(dateStr, view)

		if (isWithinLoadedRange(loadedRangeRef.current, dateStr, view, staffKey)) return

		const loadBookings = async () => {
			const isInitialLoad = bookings.length === 0
			if (isInitialLoad) setLoading(true)
			setError(null)

			try {
				const fetchStaffBookings = (staff: OrgStaffMember) =>
					bookingApi.getByStaff(staff.id, range.from, range.to, eventTypes)

				const bookingArrays = await Promise.all(
					staffToLoad.map(fetchStaffBookings),
				)

				const allBookings = bookingArrays
					.flat()
					.map(toCalendarDisplayBooking)

				setBookings(allBookings)
				loadedRangeRef.current = { ...range, view, staffKey }
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to load bookings'
				setError(message)
			} finally {
				setLoading(false)
			}
		}

		loadBookings()
	}, [staffToLoad, dateStr, view, eventTypes, reloadTick])

	return { bookings, reloadBookings, loading, error }
}

export type { UseStaffBookingsResult }
export { useStaffBookings }
```

- [ ] **Step 2: Commit**

```bash
git add lib/calendar/hooks/useStaffBookings.ts
git commit -m "feat(calendar): add useStaffBookings hook with reloadBookings"
```

---

### Task 5: Create hooks index and update calendar exports

**Files:**
- Create: `lib/calendar/hooks/index.ts`
- Modify: `lib/calendar/index.ts`

- [ ] **Step 1: Create `hooks/index.ts`**

```ts
export { useOrgInfo } from './useOrgInfo'
export type { UseOrgInfoResult } from './useOrgInfo'

export { useStaffSchedule } from './useStaffSchedule'
export type { UseStaffScheduleResult } from './useStaffSchedule'

export { useStaffBookings } from './useStaffBookings'
export type { UseStaffBookingsResult } from './useStaffBookings'

export {
	getFirstStaffId,
	getStaffToLoad,
	computeDateRange,
} from './helpers'
```

- [ ] **Step 2: Add hook exports to `lib/calendar/index.ts`**

Add at the end of the existing exports:

```ts
export {
	useOrgInfo,
	useStaffSchedule,
	useStaffBookings,
	getFirstStaffId,
	getStaffToLoad,
} from './hooks'
```

- [ ] **Step 3: Commit**

```bash
git add lib/calendar/hooks/index.ts lib/calendar/index.ts
git commit -m "feat(calendar): export granular hooks from calendar module"
```

---

### Task 6: Refactor `OrgCalendarPage` to use granular hooks

**Files:**
- Modify: `components/booking/OrgCalendarPage.tsx`

This is the main refactor. Replace the monolithic state/effect with the 3 hooks.

- [ ] **Step 1: Replace imports**

Remove these imports (no longer needed):
```ts
import { orgApi, bookingApi, eventTypeApi, scheduleApi } from '@/lib/booking-api-client'
import { toCalendarDisplayBooking } from '@/lib/booking-utils'
```

Add new imports:
```ts
import { useOrgInfo, useStaffSchedule, useStaffBookings, getFirstStaffId, getStaffToLoad } from '@/lib/calendar/hooks'
```

Keep `bookingApi` import — it's still needed for `handleConfirmWithClient`, `handleCancel`, `handleBookingSelect`, `handleBookingStatusChange`, `handleBookingReschedule`:
```ts
import { bookingApi } from '@/lib/booking-api-client'
```

- [ ] **Step 2: Replace state declarations and useEffect**

Remove these state/ref declarations:
```ts
const [orgData, setOrgData] = useState<OrgData | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [reloadTick, setReloadTick] = useState(0)
const loadedRangeRef = useRef<...>(null)
```

Remove the `OrgData` interface.

Remove the entire `useEffect` block (lines 75–154 in current file).

Remove the `forceReload` function.

Replace with:
```tsx
const { org, staffList, loading: orgLoading, error: orgError } = useOrgInfo(orgSlug)

const activeStaffId = staffIdProp ?? getFirstStaffId(staffList)

const { eventTypes, schedule, loading: scheduleLoading, error: scheduleError } =
	useStaffSchedule(activeStaffId)

const staffToLoad = getStaffToLoad(staffList, selectedStaffId, viewConfig.staffTabBehavior)

const { bookings, reloadBookings, loading: bookingsLoading, error: bookingsError } =
	useStaffBookings(staffToLoad, dateStr, view, eventTypes)

const loading = orgLoading || scheduleLoading || bookingsLoading
const error = orgError || scheduleError || bookingsError
```

- [ ] **Step 3: Update mutation handlers to use `reloadBookings()`**

Replace `forceReload()` calls with `reloadBookings()` in:

`handleBookingStatusChange`:
```tsx
const handleBookingStatusChange = async (bookingId: string, status: BookingStatus) => {
	try {
		await bookingApi.updateStatus(bookingId, status)
		setSelectedBooking(null)
		reloadBookings()
	} catch (err) {
		const message = err instanceof Error ? err.message : t('bookingFailed')
		setBookingError(message)
	}
}
```

`handleBookingReschedule`:
```tsx
const handleBookingReschedule = async (bookingId: string, newStartAt: string) => {
	try {
		await bookingApi.reschedule(bookingId, newStartAt)
		setSelectedBooking(null)
		reloadBookings()
	} catch (err) {
		const message = err instanceof Error ? err.message : t('bookingFailed')
		setBookingError(message)
	}
}
```

- [ ] **Step 4: Update references from `orgData.X` to direct variables**

All places that reference `orgData.org`, `orgData.staffList`, `orgData.bookings`, `orgData.eventTypes`, `orgData.schedule` need updating:

| Before | After |
|--------|-------|
| `orgData.org.name` | `org?.name ?? ''` — but use guard: `if (!org) return ...` |
| `orgData.staffList` | `staffList` |
| `orgData.bookings` | `bookings` |
| `orgData.eventTypes` | `eventTypes` |
| `orgData.schedule` | `schedule` |

Update the loading/error guards:
```tsx
if (loading) {
	return (
		<div className="flex items-center justify-center py-20">
			<p className="text-muted-foreground text-sm">{t('loading')}</p>
		</div>
	)
}

if (error || !org) {
	return (
		<div className="flex items-center justify-center py-20">
			<p className="text-destructive text-sm">
				{error ?? t('loadError')}
			</p>
		</div>
	)
}
```

- [ ] **Step 5: Update strategy creation**

Replace `orgData.X` references in `createOrgStrategy`:
```tsx
const strategy = createOrgStrategy({
	orgName: org.name,
	locale,
	selectStaffLabel: t('selectStaffToView'),
	bookingDetailsLabel: t('bookingDetails'),
	bookings,
	canBookForClient: viewConfig.canBookForClient,
	eventTypes,
	schedule: schedule ?? undefined,
	selectedEventTypeId,
	selectedSlot: selectedSlotTime,
	slotMode,
	confirmedBooking,
	date: dateStr,
	onSelectEventType: handleEventTypeSelect,
	onSelectSlot: handleSlotSelect,
	onConfirmWithClient: handleConfirmWithClient,
	onCancel: handleCancel,
	onResetSlot: handleResetSlot,
	onModeChange: handleModeChange,
	isSubmitting,
	bookingError,
	selectedBooking,
	onBookingSelect: handleBookingSelect,
	onBookingStatusChange: handleBookingStatusChange,
	onBookingReschedule: handleBookingReschedule,
	onBookingClose: handleBookingClose,
})
```

Update `StaffTabs`:
```tsx
const staffTabsSlot = viewConfig.showStaffTabs ? (
	<StaffTabs
		staff={staffList}
		selectedId={selectedStaffId}
		behavior={viewConfig.staffTabBehavior}
		onSelect={handleStaffSelect}
	/>
) : null
```

- [ ] **Step 6: Update `handleConfirmWithClient`**

Replace `orgData` references:
```tsx
const handleConfirmWithClient = async (data: ClientInfoData) => {
	if (!selectedEventTypeId || !selectedSlotTime) return

	const resolvedStaffId = selectedStaffId ?? getFirstStaffId(staffList)
	if (!resolvedStaffId) return

	const eventType = eventTypes.find(
		(e) => e.id === selectedEventTypeId,
	)
	if (!eventType) return

	// ... rest stays the same
}
```

- [ ] **Step 7: Clean up unused imports**

Remove imports that are no longer used:
- `useRef` (if no other refs remain)
- `toCalendarDisplayBooking`
- Any API clients that moved into hooks (`orgApi`, `eventTypeApi`, `scheduleApi`)

Remove the `OrgData` interface and `OrgStaffMember` from type imports if no longer referenced directly.

- [ ] **Step 8: Commit**

```bash
git add components/booking/OrgCalendarPage.tsx
git commit -m "refactor(calendar): replace monolithic useEffect with granular hooks"
```

---

### Task 7: Manual verification

- [ ] **Step 1: Verify the app compiles**

```bash
cd /Users/egorzozula/Desktop/Slotix-fronted/Slotix-fronted && npx next build --no-lint 2>&1 | head -50
```

Expected: no TypeScript errors related to hooks or OrgCalendarPage.

- [ ] **Step 2: Verify in browser**

Open the org calendar page. Check:
1. Org name and staff tabs render on load
2. Switching staff tab loads new eventTypes/schedule without full page reload
3. Navigating dates loads bookings without flickering
4. Creating a booking and calling `reloadBookings()` refreshes only bookings
5. Changing booking status refreshes the calendar without flicker
6. Clicking a booking opens the details panel

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(calendar): post-refactor fixes for granular hooks"
```
