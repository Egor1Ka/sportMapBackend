# Granular Hooks Refactor — OrgCalendarPage

## Problem

`OrgCalendarPage` has a monolithic `useEffect` (~80 lines) that loads all data (org, staff, schedule, eventTypes, bookings) in one call. After mutations (create/cancel/reschedule/status change), a `forceReload` hack resets a ref and bumps a `reloadTick` counter to trigger the entire effect again — reloading everything even when only bookings changed.

### What's wrong with `forceReload`

- Reloads org, staff, schedule, eventTypes unnecessarily after booking mutations
- Uses ref + state counter — indirect, hard to trace
- Single `useEffect` with 8 dependencies is fragile and hard to reason about
- No way to reload just bookings without reloading everything

## Solution: Granular Hooks (Variant C)

Split the monolithic `useEffect` into 3 independent custom hooks, each responsible for one data domain.

## Hook Specifications

### `useOrgInfo(orgSlug)`

**Responsibility:** Load org metadata and staff list. This data rarely changes within a session.

**Returns:** `{ org, staffList, loading, error }`

**Behavior:**
- Fetches on mount and when `orgSlug` changes
- Shows loading only on initial fetch (stale-while-revalidate)
- No reload mechanism needed — org/staff data is stable

**Helper functions:**

```ts
const getFirstStaffId = (staffList: OrgStaffMember[] | null): string | null => {
  if (!staffList || !staffList[0]) return null
  return staffList[0].id
}
```

### `useStaffSchedule(staffId)`

**Responsibility:** Load eventTypes and schedule for the active staff member.

**Returns:** `{ eventTypes, schedule, loading, error }`

**Behavior:**
- Fetches when `staffId` changes
- Returns empty eventTypes and null schedule when `staffId` is null
- Shows loading only on initial fetch

### `useStaffBookings(staffIds, dateRange, view, eventTypes)`

**Responsibility:** Load bookings for visible staff within the current date range.

**Returns:** `{ bookings, reloadBookings, loading, error }`

**Behavior:**
- Fetches when staffIds, dateRange, or view change
- Maintains `loadedRange` cache — skips fetch if current date is within already-loaded range
- `reloadBookings()` clears the cache and re-fetches (replaces `forceReload`)
- Shows loading only on initial fetch (stale-while-revalidate)

**Helper functions:**

```ts
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

const computeDateRange = (dateStr: string, view: ViewMode): { from: string; to: string } => {
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

const isWithinLoadedRange = (
  loaded: LoadedRange | null,
  dateStr: string,
  view: ViewMode,
  staffIds: string[],
): boolean => {
  if (!loaded) return false
  if (loaded.view !== view) return false
  if (loaded.staffKey !== staffIds.join(',')) return false
  return dateStr >= loaded.from && dateStr <= loaded.to
}
```

## OrgCalendarPage After Refactor

```tsx
const { org, staffList, loading: orgLoading, error: orgError } = useOrgInfo(orgSlug)

const activeStaffId = getFirstStaffId(staffList)
const resolvedStaffId = staffIdProp ?? activeStaffId

const { eventTypes, schedule, loading: scheduleLoading, error: scheduleError } =
  useStaffSchedule(resolvedStaffId)

const staffToLoad = staffList
  ? getStaffToLoad(staffList, selectedStaffId, viewConfig.staffTabBehavior)
  : []

const { bookings, reloadBookings, loading: bookingsLoading } =
  useStaffBookings(staffToLoad, dateStr, view, eventTypes)
```

### Mutation handlers call `reloadBookings()`

```tsx
const handleBookingStatusChange = async (bookingId: string, status: BookingStatus) => {
  try {
    await bookingApi.updateStatus(bookingId, status)
    setSelectedBooking(null)
    reloadBookings()
  } catch (err) { ... }
}
```

## What Gets Deleted

- `reloadTick` state
- `loadedRangeRef` ref
- `forceReload()` function
- `OrgData` interface
- Monolithic `useEffect` (~80 lines)
- `orgData` state (replaced by individual hook returns)

## File Structure

```
lib/calendar/hooks/
  useOrgInfo.ts
  useStaffSchedule.ts
  useStaffBookings.ts
  helpers.ts          — shared pure functions (getFirstStaffId, filterByStaffId, etc.)
  index.ts            — re-exports
```

## Constraints

- Pure React, no external data-fetching libraries
- All callbacks extracted as named functions (no inline lambdas)
- `const` only, no `let`
- Guard clauses at caller level
- Optional chaining forbidden in guards
