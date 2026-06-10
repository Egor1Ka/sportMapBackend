# Booking System API — Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Overview

API для системы бронирования. 12 эндпоинтов, 10 моделей, slot engine с тремя режимами генерации слотов.

## Stack

- JavaScript (ES modules), Express 5, Mongoose 8, Ramda
- Архитектура корневых папок (как Task) — НЕ modules/

## File Structure

```
src/
├── models/
│   ├── Booking.js              (перенос из modules/)
│   ├── EventType.js            (перенос из modules/)
│   ├── ScheduleTemplate.js     (перенос из modules/)
│   ├── ScheduleOverride.js     (перенос из modules/)
│   ├── Invitee.js              (перенос из modules/)
│   ├── Location.js             (перенос из modules/)
│   ├── Membership.js           (перенос из modules/)
│   ├── Notification.js         (перенос из modules/)
│   ├── Organization.js         (перенос из modules/)
│   └── Position.js             (перенос из modules/)
│
├── repository/
│   ├── bookingRepository.js
│   ├── eventTypeRepository.js
│   ├── scheduleTemplateRepository.js
│   ├── scheduleOverrideRepository.js
│   ├── inviteeRepository.js
│   ├── locationRepository.js
│   ├── membershipRepository.js
│   ├── notificationRepository.js
│   ├── organizationRepository.js
│   └── positionRepository.js
│
├── services/
│   ├── bookingServices.js
│   ├── eventTypeServices.js
│   ├── scheduleServices.js
│   ├── slotServices.js
│   ├── staffServices.js
│   ├── orgServices.js
│   ├── inviteeServices.js
│   └── notificationServices.js
│
├── controllers/
│   ├── bookingController.js
│   ├── eventTypeController.js
│   ├── scheduleController.js
│   ├── slotController.js
│   ├── staffController.js
│   └── orgController.js
│
├── routes/subroutes/
│   ├── bookingRoutes.js
│   ├── eventTypeRoutes.js
│   ├── scheduleRoutes.js
│   ├── slotRoutes.js
│   ├── staffRoutes.js
│   └── orgRoutes.js
│
├── dto/
│   ├── bookingDto.js
│   ├── eventTypeDto.js
│   ├── scheduleDto.js
│   ├── slotDto.js
│   ├── staffDto.js
│   └── orgDto.js
│
├── constants/
│   └── booking.js
│
└── shared/utils/
    └── slotEngine.js
```

## Endpoints

### GET /staff/:id

Find User by _id. Find active Membership for this user.
- If membership exists → take orgId and locationIds from it.
- If no membership → solo master, orgId=null, locationIds=[].
- Response: `{ id, name, avatar, position, orgId, locationIds }`
- 404 if user not found.

### GET /event-types?staffId=

Three cases combined with $or:
1. `EventType.userId = staffId` (personal, type=solo)
2. `EventType.orgId` matches + `staffPolicy='any'`
3. `staffId` in `EventType.assignedStaff[]`

Only `active=true`.

### GET /schedule/template?staffId=&orgId=&locationId=

Find active ScheduleTemplate:
- staffId, orgId, locationId match
- validFrom <= today, validTo = null OR validTo >= today
- 404 if not found.

### PUT /schedule/template

Body: `{ staffId, orgId, locationId, weeklyHours, slotMode, slotStepMin }`

Old template NEVER deleted (schedule history).
Find current (validTo=null) → set validTo=yesterday.
Create new with validFrom=today.
Return new template.

### POST /schedule/override

Body: `{ staffId, orgId, locationId, date, enabled, slots, reason }`

One override per date. Upsert.
Override NEVER deleted.

### GET /slots?staffId=&eventTypeId=&date=&locationId=&slotMode=

All logic in slotServices.js → slotEngine.js.

Steps:
1. Get EventType → durationMin, minNotice, slotStepMin
2. Find active ScheduleTemplate (staffId + orgId + locationId + date in validFrom/validTo)
3. Check ScheduleOverride for this date:
   - override.enabled=false → return []
   - override.enabled=true → use override.slots
   - no override → use weeklyHours from template
4. Check weeklyHours for day of week:
   - enabled=false → return []
   - Take slots[0].start and slots[0].end as workStart/workEnd
5. Find all Bookings for staff on this date (status: confirmed + pending_payment)
6. Call slotEngine.getAvailableSlots(...)
7. Return `[{ startMin, startTime, endTime, isExtra }]`

### POST /bookings

Body: `{ eventTypeId, staffId, startAt (ISO UTC), timezone, invitee }`

1. Get EventType → durationMin → compute endAt
2. Race condition guard: check for overlapping booking (409 slot_taken)
3. Find or create Invitee by email or phone (upsert)
4. Create Booking with hosts, inviteeSnapshot, cancelToken, rescheduleToken, payment.status
5. Create Notifications (booking_confirmed, reminder_24h, reminder_1h with time guards)
6. Return BookingResponse

### GET /bookings/by-staff?staffId=&dateFrom=&dateTo=&locationId=&status=

Find Bookings where staffId in hosts[].userId.
startAt in dateFrom–dateTo range.
Optional filters: locationId, status (comma-separated).
Sort by startAt ascending.

### DELETE /bookings/:id

Body: `{ reason? }`

Set status='cancelled', cancelReason=reason.
Null out cancelToken and rescheduleToken.
All Notifications with status='scheduled' → 'skipped'.

### POST /bookings/cancel-by-token

Body: `{ cancelToken, reason? }`

Find Booking by cancelToken. Same logic as DELETE /bookings/:id.
404 if token not found or already used.

### GET /org/:slug

Find Organization by slug.
Response: `{ id, name, slug, logo }`
404 if not found.

### GET /org/:slug/staff

Find Organization by slug.
Find all active Memberships for this org.
For each member:
- Get User data
- Get Position if positionId exists
- Count confirmed bookings for today (or query param date)
Response: `[{ id, name, avatar, position, bookingCount }]`

## Slot Engine

### Signature

```js
getAvailableSlots({
  workStart,    // minutes from midnight (540 = 09:00)
  workEnd,      // minutes from midnight (1080 = 18:00)
  duration,     // service duration in minutes
  slotStep,     // grid step in minutes
  slotMode,     // 'fixed' | 'optimal' | 'dynamic'
  bookings,     // [{ startMin, duration }] sorted by startMin
  minNotice,    // minimum minutes before slot start
  nowMin,       // current time in minutes from midnight (template timezone)
}) → [{ startMin, startTime, endTime, isExtra }]
```

### Modes

**fixed** — Grid from workStart with slotStep, never changes. Booking 11:00–12:30 → next slot 13:00, gap 12:30–13:00 is lost.

**optimal** — Same fixed grid, but after each booking end adds one extra slot if it doesn't fall on the grid. Booking 11:00–12:30 → grid stays 10:00, 11:00, 12:00, 13:00... plus extra slot at 12:30 (isExtra=true).

**dynamic** — After last booking, entire grid recalculates from booking end. Booking 11:00–12:30 → next slots 12:30, 13:30, 14:30... Regular 13:00, 14:00 disappear.

### Algorithm

1. Sort bookings by startMin
2. Build candidate grid (mode-dependent)
3. Remove conflicting slots (overlap with bookings)
4. Remove slots violating minNotice (startMin < nowMin + minNotice)
5. Format: startMin → startTime ("09:00"), endTime ("09:30")

## Dependencies Between Layers

```
staffServices       → userRepository, membershipRepository, positionRepository
eventTypeServices   → eventTypeRepository, membershipRepository
slotServices        → eventTypeRepository, scheduleTemplateRepository,
                      scheduleOverrideRepository, bookingRepository, slotEngine
bookingServices     → eventTypeRepository, bookingRepository, inviteeRepository,
                      notificationServices
orgServices         → organizationRepository, membershipRepository, userRepository,
                      positionRepository, bookingRepository
notificationServices → notificationRepository
scheduleServices    → scheduleTemplateRepository, scheduleOverrideRepository
```

## Error Handling

| Endpoint | Success | Errors |
|----------|---------|--------|
| GET /staff/:id | 200 | 404 user not found |
| GET /event-types | 200 | 400 missing staffId |
| GET /schedule/template | 200 | 404 template not found |
| PUT /schedule/template | 200 | 400 invalid data |
| POST /schedule/override | 200 | 400 invalid data |
| GET /slots | 200 | 400 missing params, 404 eventType/template |
| POST /bookings | 201 | 409 slot_taken, 404 eventType, 400 validation |
| GET /bookings/by-staff | 200 | 400 missing params |
| DELETE /bookings/:id | 200 | 404 booking not found |
| POST /bookings/cancel-by-token | 200 | 404 token not found |
| GET /org/:slug | 200 | 404 org not found |
| GET /org/:slug/staff | 200 | 404 org not found |

## Edge Cases

### Slot Engine
- Day off (weeklyHours.enabled=false) → return []
- Override enabled=false → return []
- Override enabled=true → use override.slots instead of weeklyHours
- All slots in the past → return []
- Booking fills entire day → return []
- duration > workEnd - workStart → return []

### Notifications
- startAt - now < 1h → don't create reminder_1h
- startAt - now < 24h → don't create reminder_24h
- Booking cancelled → all scheduled notifications → skipped

### Bookings
- Race condition on POST /bookings → findOne conflict check before create, 409 if taken
- Cancel already cancelled → idempotent, no change
- cancel-by-token with used/null token → 404

## Decisions

- **JS not TS** — matches existing codebase
- **Root-level architecture** (like Task) — not modules/
- **GET /staff/:id** not /:slug — User model has no slug field
- **slotEngine in shared/utils/** — pure function, no model dependencies
- **Models moved from modules/ to models/** — consistent with Task pattern
- **price.amount from EventType** — determines payment.status on booking creation
