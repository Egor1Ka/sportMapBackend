# Booking System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 12 API endpoints for a booking system with slot generation engine.

**Architecture:** Root-level architecture (like Task) — models, repositories, services, controllers, routes, DTOs, constants in their respective `src/` directories. Slot engine as pure function in `src/shared/utils/slotEngine.js`. Models moved from `src/modules/*/model/` to `src/models/`.

**Tech Stack:** JavaScript (ES modules), Express 5, Mongoose 8, Ramda

**Spec:** `docs/superpowers/specs/2026-03-26-booking-system-design.md`

---

### Task 1: Move models to src/models/ and add constants

**Files:**
- Move: `src/modules/booking/model/Booking.js` → `src/models/Booking.js`
- Move: `src/modules/eventType/model/EventType.js` → `src/models/EventType.js`
- Move: `src/modules/schedule/model/ScheduleTemplate.js` → `src/models/ScheduleTemplate.js`
- Move: `src/modules/schedule/model/ScheduleOverride.js` → `src/models/ScheduleOverride.js`
- Move: `src/modules/invitee/model/Invitee.js` → `src/models/Invitee.js`
- Move: `src/modules/location/model/Location.js` → `src/models/Location.js`
- Move: `src/modules/membership/model/Membership.js` → `src/models/Membership.js`
- Move: `src/modules/notification/model/Notification.js` → `src/models/Notification.js`
- Move: `src/modules/organization/model/Organization.js` → `src/models/Organization.js`
- Move: `src/modules/position/model/Position.js` → `src/models/Position.js`
- Create: `src/constants/booking.js`

- [ ] **Step 1: Move all 10 model files**

```bash
mv src/modules/booking/model/Booking.js src/models/Booking.js
mv src/modules/eventType/model/EventType.js src/models/EventType.js
mv src/modules/schedule/model/ScheduleTemplate.js src/models/ScheduleTemplate.js
mv src/modules/schedule/model/ScheduleOverride.js src/models/ScheduleOverride.js
mv src/modules/invitee/model/Invitee.js src/models/Invitee.js
mv src/modules/location/model/Location.js src/models/Location.js
mv src/modules/membership/model/Membership.js src/models/Membership.js
mv src/modules/notification/model/Notification.js src/models/Notification.js
mv src/modules/organization/model/Organization.js src/models/Organization.js
mv src/modules/position/model/Position.js src/models/Position.js
```

- [ ] **Step 2: Remove empty module directories**

```bash
rm -rf src/modules/booking src/modules/eventType src/modules/schedule src/modules/invitee src/modules/location src/modules/membership src/modules/notification src/modules/organization src/modules/position
```

- [ ] **Step 3: Create booking constants**

Create `src/constants/booking.js`:

```js
const BOOKING_STATUS = {
  PENDING_PAYMENT: "pending_payment",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
  COMPLETED: "completed",
};

const BOOKING_STATUSES = Object.values(BOOKING_STATUS);

const PAYMENT_STATUS = {
  NONE: "none",
  PENDING: "pending",
  PAID: "paid",
  REFUNDED: "refunded",
  FAILED: "failed",
};

const PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

const SLOT_MODE = {
  FIXED: "fixed",
  OPTIMAL: "optimal",
  DYNAMIC: "dynamic",
};

const SLOT_MODES = Object.values(SLOT_MODE);

const ACTIVE_BOOKING_STATUSES = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.PENDING_PAYMENT,
];

const NOTIFICATION_TYPE = {
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_CANCELLED: "booking_cancelled",
  BOOKING_RESCHEDULED: "booking_rescheduled",
  REMINDER_24H: "reminder_24h",
  REMINDER_1H: "reminder_1h",
  FOLLOW_UP: "follow_up",
};

const NOTIFICATION_STATUS = {
  SCHEDULED: "scheduled",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
};

const MEMBERSHIP_STATUS = {
  ACTIVE: "active",
  INVITED: "invited",
  SUSPENDED: "suspended",
  LEFT: "left",
};

const HOST_ROLE = {
  LEAD: "lead",
  ASSISTANT: "assistant",
  OBSERVER: "observer",
};

export {
  BOOKING_STATUS,
  BOOKING_STATUSES,
  PAYMENT_STATUS,
  PAYMENT_STATUSES,
  SLOT_MODE,
  SLOT_MODES,
  ACTIVE_BOOKING_STATUSES,
  NOTIFICATION_TYPE,
  NOTIFICATION_STATUS,
  MEMBERSHIP_STATUS,
  HOST_ROLE,
};
```

- [ ] **Step 4: Add booking httpStatus entries**

Add to `src/shared/utils/http/httpStatus.js`:

```js
export const bookingStatus = {
  SLOT_TAKEN: { status: 409, message: "slotTaken" },
};
```

- [ ] **Step 5: Commit**

```bash
git add src/models/ src/constants/booking.js src/shared/utils/http/httpStatus.js
git commit -m "feat(booking): move models to src/models and add booking constants"
```

---

### Task 2: DTOs

**Files:**
- Create: `src/dto/bookingDto.js`
- Create: `src/dto/eventTypeDto.js`
- Create: `src/dto/scheduleDto.js`
- Create: `src/dto/slotDto.js`
- Create: `src/dto/staffDto.js`
- Create: `src/dto/orgDto.js`
- Create: `src/dto/inviteeDto.js`
- Create: `src/dto/notificationDto.js`

- [ ] **Step 1: Create all DTOs**

Create `src/dto/bookingDto.js`:

```js
const toHostDto = (host) => ({
  userId: host.userId.toString(),
  role: host.role,
});

const toInviteeSnapshotDto = (snapshot) => ({
  name: snapshot.name,
  email: snapshot.email,
  phone: snapshot.phone,
});

const toPaymentDto = (payment) => ({
  status: payment.status,
  amount: payment.amount,
  currency: payment.currency,
});

const toBookingDto = (doc) => ({
  id: doc._id.toString(),
  eventTypeId: doc.eventTypeId.toString(),
  hosts: doc.hosts.map(toHostDto),
  inviteeId: doc.inviteeId.toString(),
  orgId: doc.orgId ? doc.orgId.toString() : null,
  locationId: doc.locationId ? doc.locationId.toString() : null,
  startAt: doc.startAt,
  endAt: doc.endAt,
  timezone: doc.timezone,
  status: doc.status,
  inviteeSnapshot: toInviteeSnapshotDto(doc.inviteeSnapshot),
  clientNotes: doc.clientNotes,
  payment: toPaymentDto(doc.payment),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export { toBookingDto };
```

Create `src/dto/eventTypeDto.js`:

```js
const toPriceDto = (price) => ({
  amount: price.amount,
  currency: price.currency,
});

const toEventTypeDto = (doc) => ({
  id: doc._id.toString(),
  userId: doc.userId ? doc.userId.toString() : null,
  orgId: doc.orgId ? doc.orgId.toString() : null,
  slug: doc.slug,
  name: doc.name,
  durationMin: doc.durationMin,
  type: doc.type,
  color: doc.color,
  price: doc.price ? toPriceDto(doc.price) : null,
  bufferAfter: doc.bufferAfter,
  minNotice: doc.minNotice,
  slotStepMin: doc.slotStepMin,
  active: doc.active,
});

export { toEventTypeDto };
```

Create `src/dto/scheduleDto.js`:

```js
const toTimeSlotDto = (slot) => ({
  start: slot.start,
  end: slot.end,
});

const toWeeklyHoursDto = (entry) => ({
  day: entry.day,
  enabled: entry.enabled,
  slots: entry.slots.map(toTimeSlotDto),
});

const toScheduleTemplateDto = (doc) => ({
  id: doc._id.toString(),
  staffId: doc.staffId.toString(),
  orgId: doc.orgId ? doc.orgId.toString() : null,
  locationId: doc.locationId ? doc.locationId.toString() : null,
  validFrom: doc.validFrom,
  validTo: doc.validTo,
  timezone: doc.timezone,
  slotMode: doc.slotMode,
  slotStepMin: doc.slotStepMin,
  weeklyHours: doc.weeklyHours.map(toWeeklyHoursDto),
});

const toScheduleOverrideDto = (doc) => ({
  id: doc._id.toString(),
  staffId: doc.staffId.toString(),
  orgId: doc.orgId ? doc.orgId.toString() : null,
  locationId: doc.locationId ? doc.locationId.toString() : null,
  date: doc.date,
  enabled: doc.enabled,
  slots: doc.slots.map(toTimeSlotDto),
  reason: doc.reason,
});

export { toScheduleTemplateDto, toScheduleOverrideDto };
```

Create `src/dto/slotDto.js`:

```js
const padTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  return `${hh}:${mm}`;
};

const toSlotDto = (duration) => (slot) => ({
  startMin: slot.startMin,
  startTime: padTime(slot.startMin),
  endTime: padTime(slot.startMin + duration),
  isExtra: slot.isExtra || false,
});

export { toSlotDto };
```

Create `src/dto/staffDto.js`:

```js
const toStaffDto = (user, position, membership) => ({
  id: user.id,
  name: user.name,
  avatar: user.avatar,
  position: position ? position.name : null,
  orgId: membership ? membership.orgId.toString() : null,
  locationIds: membership ? membership.locationIds.map((id) => id.toString()) : [],
});

const toOrgStaffDto = (user, position, bookingCount) => ({
  id: user.id,
  name: user.name,
  avatar: user.avatar,
  position: position ? position.name : null,
  bookingCount,
});

export { toStaffDto, toOrgStaffDto };
```

Create `src/dto/orgDto.js`:

```js
const toOrgDto = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  slug: doc.slug,
  logo: doc.settings ? doc.settings.logoUrl : null,
});

export { toOrgDto };
```

Create `src/dto/inviteeDto.js`:

```js
const toInviteeDto = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  email: doc.email,
  phone: doc.phone,
  phoneCountry: doc.phoneCountry,
  timezone: doc.timezone,
});

export { toInviteeDto };
```

Create `src/dto/notificationDto.js`:

```js
const toNotificationDto = (doc) => ({
  id: doc._id.toString(),
  bookingId: doc.bookingId.toString(),
  recipientId: doc.recipientId.toString(),
  recipientType: doc.recipientType,
  channel: doc.channel,
  type: doc.type,
  status: doc.status,
  scheduledAt: doc.scheduledAt,
});

export { toNotificationDto };
```

- [ ] **Step 2: Commit**

```bash
git add src/dto/
git commit -m "feat(booking): add DTOs for all booking system entities"
```

---

### Task 3: Repositories

**Files:**
- Create: `src/repository/organizationRepository.js`
- Create: `src/repository/positionRepository.js`
- Create: `src/repository/locationRepository.js`
- Create: `src/repository/membershipRepository.js`
- Create: `src/repository/eventTypeRepository.js`
- Create: `src/repository/scheduleTemplateRepository.js`
- Create: `src/repository/scheduleOverrideRepository.js`
- Create: `src/repository/inviteeRepository.js`
- Create: `src/repository/bookingRepository.js`
- Create: `src/repository/notificationRepository.js`

- [ ] **Step 1: Create organizationRepository.js**

```js
import Organization from "../models/Organization.js";
import { toOrgDto } from "../dto/orgDto.js";

const getOrgBySlug = async (slug) => {
  const doc = await Organization.findOne({ slug });
  if (!doc) return null;
  return toOrgDto(doc);
};

const getOrgById = async (id) => {
  const doc = await Organization.findById(id);
  if (!doc) return null;
  return toOrgDto(doc);
};

export { getOrgBySlug, getOrgById };
```

- [ ] **Step 2: Create positionRepository.js**

```js
import Position from "../models/Position.js";

const getPositionById = async (id) => {
  const doc = await Position.findById(id);
  if (!doc) return null;
  return { id: doc._id.toString(), name: doc.name, level: doc.level, color: doc.color };
};

export { getPositionById };
```

- [ ] **Step 3: Create locationRepository.js**

```js
import Location from "../models/Location.js";

const getLocationById = async (id) => {
  const doc = await Location.findById(id);
  if (!doc) return null;
  return doc;
};

export { getLocationById };
```

- [ ] **Step 4: Create membershipRepository.js**

```js
import Membership from "../models/Membership.js";
import { MEMBERSHIP_STATUS } from "../constants/booking.js";

const getActiveMembership = async (userId) => {
  const doc = await Membership.findOne({
    userId,
    status: MEMBERSHIP_STATUS.ACTIVE,
  });
  return doc;
};

const getActiveMembersByOrg = async (orgId) => {
  const docs = await Membership.find({
    orgId,
    status: MEMBERSHIP_STATUS.ACTIVE,
  });
  return docs;
};

export { getActiveMembership, getActiveMembersByOrg };
```

- [ ] **Step 5: Create eventTypeRepository.js**

```js
import EventType from "../models/EventType.js";
import { toEventTypeDto } from "../dto/eventTypeDto.js";

const getEventTypeById = async (id) => {
  const doc = await EventType.findById(id);
  if (!doc) return null;
  return doc;
};

const getEventTypesForStaff = async (staffId, orgId) => {
  const query = {
    active: true,
    $or: [
      { userId: staffId },
      ...(orgId
        ? [
            { orgId, staffPolicy: "any" },
            { assignedStaff: staffId },
          ]
        : []),
    ],
  };
  const docs = await EventType.find(query);
  return docs.map(toEventTypeDto);
};

export { getEventTypeById, getEventTypesForStaff };
```

- [ ] **Step 6: Create scheduleTemplateRepository.js**

```js
import ScheduleTemplate from "../models/ScheduleTemplate.js";
import { toScheduleTemplateDto } from "../dto/scheduleDto.js";

const findActiveTemplate = async (staffId, orgId, locationId, date) => {
  const query = {
    staffId,
    orgId: orgId || null,
    locationId: locationId || null,
    validFrom: { $lte: date },
    $or: [{ validTo: null }, { validTo: { $gte: date } }],
  };
  const doc = await ScheduleTemplate.findOne(query);
  if (!doc) return null;
  return doc;
};

const findCurrentTemplate = async (staffId, orgId, locationId) => {
  const doc = await ScheduleTemplate.findOne({
    staffId,
    orgId: orgId || null,
    locationId: locationId || null,
    validTo: null,
  });
  return doc;
};

const createTemplate = async (data) => {
  const doc = await ScheduleTemplate.create(data);
  return toScheduleTemplateDto(doc);
};

const updateTemplateValidTo = async (id, validTo) => {
  const doc = await ScheduleTemplate.findByIdAndUpdate(
    id,
    { validTo },
    { new: true },
  );
  return doc;
};

const findActiveTemplateDto = async (staffId, orgId, locationId, date) => {
  const doc = await findActiveTemplate(staffId, orgId, locationId, date);
  if (!doc) return null;
  return toScheduleTemplateDto(doc);
};

export {
  findActiveTemplate,
  findActiveTemplateDto,
  findCurrentTemplate,
  createTemplate,
  updateTemplateValidTo,
};
```

- [ ] **Step 7: Create scheduleOverrideRepository.js**

```js
import ScheduleOverride from "../models/ScheduleOverride.js";
import { toScheduleOverrideDto } from "../dto/scheduleDto.js";

const findOverrideByDate = async (staffId, orgId, locationId, date) => {
  const doc = await ScheduleOverride.findOne({
    staffId,
    orgId: orgId || null,
    locationId: locationId || null,
    date,
  });
  return doc;
};

const upsertOverride = async (data) => {
  const { staffId, orgId, locationId, date, ...rest } = data;
  const doc = await ScheduleOverride.findOneAndUpdate(
    {
      staffId,
      orgId: orgId || null,
      locationId: locationId || null,
      date,
    },
    { staffId, orgId: orgId || null, locationId: locationId || null, date, ...rest },
    { upsert: true, new: true },
  );
  return toScheduleOverrideDto(doc);
};

export { findOverrideByDate, upsertOverride };
```

- [ ] **Step 8: Create inviteeRepository.js**

```js
import Invitee from "../models/Invitee.js";
import { toInviteeDto } from "../dto/inviteeDto.js";

const findOrCreateInvitee = async ({ name, email, phone, phoneCountry, timezone }) => {
  const filter = email ? { email } : { phone };
  const update = {
    name,
    ...(email && { email }),
    ...(phone && { phone }),
    ...(phoneCountry && { phoneCountry }),
    ...(timezone && { timezone }),
  };
  const doc = await Invitee.findOneAndUpdate(filter, update, {
    upsert: true,
    new: true,
  });
  return toInviteeDto(doc);
};

export { findOrCreateInvitee };
```

- [ ] **Step 9: Create bookingRepository.js**

```js
import Booking from "../models/Booking.js";
import { toBookingDto } from "../dto/bookingDto.js";
import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUS } from "../constants/booking.js";

const createBooking = async (data) => {
  const doc = await Booking.create(data);
  return toBookingDto(doc);
};

const findConflict = async (staffId, startAt, endAt) => {
  const doc = await Booking.findOne({
    "hosts.userId": staffId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  });
  return doc;
};

const findByStaffAndDate = async (staffId, dateStart, dateEnd) => {
  const docs = await Booking.find({
    "hosts.userId": staffId,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    startAt: { $gte: dateStart, $lt: dateEnd },
  });
  return docs;
};

const findByStaffFiltered = async ({ staffId, dateFrom, dateTo, locationId, statuses }) => {
  const query = {
    "hosts.userId": staffId,
    startAt: { $gte: dateFrom, $lte: dateTo },
  };
  if (locationId) query.locationId = locationId;
  if (statuses) query.status = { $in: statuses };
  const docs = await Booking.find(query).sort({ startAt: 1 });
  return docs.map(toBookingDto);
};

const findBookingById = async (id) => {
  const doc = await Booking.findById(id);
  return doc;
};

const findBookingByToken = async (cancelToken) => {
  const doc = await Booking.findOne({ cancelToken });
  return doc;
};

const cancelBooking = async (id, reason) => {
  const doc = await Booking.findByIdAndUpdate(
    id,
    {
      status: BOOKING_STATUS.CANCELLED,
      cancelReason: reason || null,
      cancelToken: null,
      rescheduleToken: null,
    },
    { new: true },
  );
  if (!doc) return null;
  return toBookingDto(doc);
};

const countConfirmedBookings = async (staffId, dateStart, dateEnd) => {
  const count = await Booking.countDocuments({
    "hosts.userId": staffId,
    status: BOOKING_STATUS.CONFIRMED,
    startAt: { $gte: dateStart, $lt: dateEnd },
  });
  return count;
};

export {
  createBooking,
  findConflict,
  findByStaffAndDate,
  findByStaffFiltered,
  findBookingById,
  findBookingByToken,
  cancelBooking,
  countConfirmedBookings,
};
```

- [ ] **Step 10: Create notificationRepository.js**

```js
import Notification from "../models/Notification.js";
import { toNotificationDto } from "../dto/notificationDto.js";
import { NOTIFICATION_STATUS } from "../constants/booking.js";

const createNotification = async (data) => {
  const doc = await Notification.create(data);
  return toNotificationDto(doc);
};

const createManyNotifications = async (dataArray) => {
  const docs = await Notification.insertMany(dataArray);
  return docs.map(toNotificationDto);
};

const skipScheduledByBooking = async (bookingId) => {
  await Notification.updateMany(
    { bookingId, status: NOTIFICATION_STATUS.SCHEDULED },
    { status: NOTIFICATION_STATUS.SKIPPED },
  );
};

export { createNotification, createManyNotifications, skipScheduledByBooking };
```

- [ ] **Step 11: Commit**

```bash
git add src/repository/
git commit -m "feat(booking): add repositories for all booking system entities"
```

---

### Task 4: Slot Engine

**Files:**
- Create: `src/shared/utils/slotEngine.js`

This is a pure function with no dependencies. Perfect for unit testing.

- [ ] **Step 1: Create slotEngine.js**

```js
const buildFixedGrid = (workStart, workEnd, slotStep, duration) => {
  const candidates = [];
  const limit = workEnd - duration;
  const addCandidate = (startMin) => {
    if (startMin <= limit) candidates.push({ startMin, isExtra: false });
  };

  let current = workStart;
  while (current <= limit) {
    addCandidate(current);
    current = current + slotStep;
  }
  return candidates;
};

const isOnGrid = (startMin, workStart, slotStep) =>
  (startMin - workStart) % slotStep === 0;

const buildOptimalGrid = (workStart, workEnd, slotStep, duration, bookings) => {
  const fixed = buildFixedGrid(workStart, workEnd, slotStep, duration);
  const limit = workEnd - duration;

  const extraSlots = bookings
    .map(toBookingEnd)
    .filter((bookingEnd) => !isOnGrid(bookingEnd, workStart, slotStep))
    .filter((bookingEnd) => bookingEnd <= limit)
    .map((bookingEnd) => ({ startMin: bookingEnd, isExtra: true }));

  const merged = [...fixed, ...extraSlots];
  const byStartMin = (a, b) => a.startMin - b.startMin;
  return [...merged].sort(byStartMin);
};

const toBookingEnd = (booking) => booking.startMin + booking.duration;

const buildDynamicGrid = (workStart, workEnd, slotStep, duration, bookings) => {
  const limit = workEnd - duration;
  const sorted = [...bookings].sort((a, b) => a.startMin - b.startMin);

  const candidates = [];
  let segmentStart = workStart;

  const addSegmentSlots = (from, until) => {
    let current = from;
    while (current <= limit && current + duration <= until) {
      candidates.push({ startMin: current, isExtra: false });
      current = current + slotStep;
    }
  };

  const processBooking = (booking) => {
    const bookingStart = booking.startMin;
    const bookingEnd = toBookingEnd(booking);
    addSegmentSlots(segmentStart, bookingStart);
    segmentStart = bookingEnd;
  };

  sorted.forEach(processBooking);
  addSegmentSlots(segmentStart, workEnd);

  return candidates;
};

const GRID_BUILDERS = {
  fixed: (workStart, workEnd, slotStep, duration) =>
    buildFixedGrid(workStart, workEnd, slotStep, duration),
  optimal: (workStart, workEnd, slotStep, duration, bookings) =>
    buildOptimalGrid(workStart, workEnd, slotStep, duration, bookings),
  dynamic: (workStart, workEnd, slotStep, duration, bookings) =>
    buildDynamicGrid(workStart, workEnd, slotStep, duration, bookings),
};

const hasConflict = (slotStart, duration, booking) =>
  slotStart < booking.startMin + booking.duration &&
  slotStart + duration > booking.startMin;

const isConflicting = (duration, bookings) => (slot) =>
  bookings.some((booking) => hasConflict(slot.startMin, duration, booking));

const isExpired = (nowMin, minNotice) => (slot) =>
  slot.startMin < nowMin + minNotice;

const getAvailableSlots = ({
  workStart,
  workEnd,
  duration,
  slotStep,
  slotMode = "fixed",
  bookings = [],
  minNotice = 0,
  nowMin = 0,
}) => {
  if (duration > workEnd - workStart) return [];

  const buildGrid = GRID_BUILDERS[slotMode];
  const candidates = buildGrid(workStart, workEnd, slotStep, duration, bookings);

  const conflicting = isConflicting(duration, bookings);
  const expired = isExpired(nowMin, minNotice);

  const isAvailable = (slot) => !conflicting(slot) && !expired(slot);

  return candidates.filter(isAvailable);
};

export { getAvailableSlots };
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/utils/slotEngine.js
git commit -m "feat(booking): add slot engine with fixed/optimal/dynamic modes"
```

---

### Task 5: Services — notification, invitee, staff

**Files:**
- Create: `src/services/notificationServices.js`
- Create: `src/services/inviteeServices.js`
- Create: `src/services/staffServices.js`

- [ ] **Step 1: Create notificationServices.js**

```js
import {
  createManyNotifications,
  skipScheduledByBooking,
} from "../repository/notificationRepository.js";
import { NOTIFICATION_TYPE, NOTIFICATION_STATUS } from "../constants/booking.js";

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

const buildConfirmedNotification = (booking) => ({
  bookingId: booking._id,
  recipientId: booking.inviteeId,
  recipientType: "invitee",
  channel: "email",
  type: NOTIFICATION_TYPE.BOOKING_CONFIRMED,
  status: NOTIFICATION_STATUS.SCHEDULED,
  scheduledAt: new Date(),
});

const buildReminder24h = (booking, now) => {
  const diff = booking.startAt.getTime() - now.getTime();
  if (diff < TWENTY_FOUR_HOURS_MS) return null;
  return {
    bookingId: booking._id,
    recipientId: booking.inviteeId,
    recipientType: "invitee",
    channel: "email",
    type: NOTIFICATION_TYPE.REMINDER_24H,
    status: NOTIFICATION_STATUS.SCHEDULED,
    scheduledAt: new Date(booking.startAt.getTime() - TWENTY_FOUR_HOURS_MS),
  };
};

const buildReminder1h = (booking, now) => {
  const diff = booking.startAt.getTime() - now.getTime();
  if (diff < ONE_HOUR_MS) return null;
  return {
    bookingId: booking._id,
    recipientId: booking.inviteeId,
    recipientType: "invitee",
    channel: "email",
    type: NOTIFICATION_TYPE.REMINDER_1H,
    status: NOTIFICATION_STATUS.SCHEDULED,
    scheduledAt: new Date(booking.startAt.getTime() - ONE_HOUR_MS),
  };
};

const isNotNull = (item) => item !== null;

const createBookingNotifications = async (booking) => {
  const now = new Date();
  const notifications = [
    buildConfirmedNotification(booking),
    buildReminder24h(booking, now),
    buildReminder1h(booking, now),
  ].filter(isNotNull);

  return createManyNotifications(notifications);
};

const skipNotifications = async (bookingId) => {
  return skipScheduledByBooking(bookingId);
};

export { createBookingNotifications, skipNotifications };
```

- [ ] **Step 2: Create inviteeServices.js**

```js
import { findOrCreateInvitee as repoFindOrCreate } from "../repository/inviteeRepository.js";

const findOrCreateInvitee = async (inviteeData) => {
  return repoFindOrCreate(inviteeData);
};

export { findOrCreateInvitee };
```

- [ ] **Step 3: Create staffServices.js**

```js
import { getUserById } from "../modules/user/index.js";
import { getActiveMembership } from "../repository/membershipRepository.js";
import { getPositionById } from "../repository/positionRepository.js";
import { toStaffDto } from "../dto/staffDto.js";

const getStaffProfile = async (id) => {
  const user = await getUserById(id);
  if (!user) return null;

  const membership = await getActiveMembership(id);
  const position = membership && membership.positionId
    ? await getPositionById(membership.positionId)
    : null;

  return toStaffDto(user, position, membership);
};

export { getStaffProfile };
```

- [ ] **Step 4: Commit**

```bash
git add src/services/notificationServices.js src/services/inviteeServices.js src/services/staffServices.js
git commit -m "feat(booking): add notification, invitee, and staff services"
```

---

### Task 6: Services — eventType, schedule, slot

**Files:**
- Create: `src/services/eventTypeServices.js`
- Create: `src/services/scheduleServices.js`
- Create: `src/services/slotServices.js`

- [ ] **Step 1: Create eventTypeServices.js**

```js
import {
  getEventTypeById as repoGetById,
  getEventTypesForStaff as repoGetForStaff,
} from "../repository/eventTypeRepository.js";
import { getActiveMembership } from "../repository/membershipRepository.js";

const getEventTypeById = async (id) => {
  return repoGetById(id);
};

const getEventTypesForStaff = async (staffId) => {
  const membership = await getActiveMembership(staffId);
  const orgId = membership ? membership.orgId : null;
  return repoGetForStaff(staffId, orgId);
};

export { getEventTypeById, getEventTypesForStaff };
```

- [ ] **Step 2: Create scheduleServices.js**

```js
import {
  findActiveTemplateDto,
  findCurrentTemplate,
  createTemplate,
  updateTemplateValidTo,
} from "../repository/scheduleTemplateRepository.js";
import { upsertOverride } from "../repository/scheduleOverrideRepository.js";

const getActiveTemplate = async (staffId, orgId, locationId, date) => {
  return findActiveTemplateDto(staffId, orgId, locationId, date);
};

const yesterday = (date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d;
};

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
    timezone: timezone || "UTC",
    slotMode: slotMode || "fixed",
    slotStepMin,
    weeklyHours,
  });

  return newTemplate;
};

const upsertScheduleOverride = async (data) => {
  return upsertOverride(data);
};

export { getActiveTemplate, rotateTemplate, upsertScheduleOverride };
```

- [ ] **Step 3: Create slotServices.js**

```js
import { getEventTypeById } from "../repository/eventTypeRepository.js";
import { findActiveTemplate } from "../repository/scheduleTemplateRepository.js";
import { findOverrideByDate } from "../repository/scheduleOverrideRepository.js";
import { findByStaffAndDate } from "../repository/bookingRepository.js";
import { getAvailableSlots } from "../shared/utils/slotEngine.js";
import { toSlotDto } from "../dto/slotDto.js";

const WEEKDAY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const parseHHMM = (str) => {
  const [hh, mm] = str.split(":").map(Number);
  return hh * 60 + mm;
};

const toBookingSlot = (template, booking) => {
  const startDate = new Date(booking.startAt);
  const tzOffset = getTimezoneOffsetMin(startDate, template.timezone);
  const startMin = startDate.getUTCHours() * 60 + startDate.getUTCMinutes() + tzOffset;
  const durationMs = booking.endAt.getTime() - booking.startAt.getTime();
  const duration = Math.round(durationMs / 60000);
  return { startMin, duration };
};

const getTimezoneOffsetMin = (date, timezone) => {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
};

const getNowMin = (timezone) => {
  const now = new Date();
  const tzOffset = getTimezoneOffsetMin(now, timezone);
  return now.getUTCHours() * 60 + now.getUTCMinutes() + tzOffset;
};

const getDateRange = (dateStr, timezone) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  const offset = getTimezoneOffsetMin(dayStart, timezone) * 60000;
  return {
    dateStart: new Date(dayStart.getTime() - offset),
    dateEnd: new Date(dayEnd.getTime() - offset),
  };
};

const getSlotsForDate = async ({ staffId, eventTypeId, date, locationId, slotMode: querySlotMode }) => {
  const eventType = await getEventTypeById(eventTypeId);
  if (!eventType) return { error: "eventType_not_found" };

  const durationMin = eventType.durationMin;
  const minNotice = eventType.minNotice || 0;

  const membership = null; // orgId comes from query or can be derived
  const template = await findActiveTemplate(staffId, null, locationId || null, new Date(date));
  if (!template) return { error: "template_not_found" };

  const override = await findOverrideByDate(staffId, template.orgId, template.locationId, new Date(date));

  if (override && !override.enabled) return { slots: [] };

  const requestDate = new Date(date);
  const dayOfWeek = WEEKDAY_INDEX[requestDate.getDay()];

  let workStart;
  let workEnd;

  if (override && override.enabled) {
    if (!override.slots || override.slots.length === 0) return { slots: [] };
    workStart = parseHHMM(override.slots[0].start);
    workEnd = parseHHMM(override.slots[0].end);
  } else {
    const dayEntry = template.weeklyHours.find((wh) => wh.day === dayOfWeek);
    if (!dayEntry || !dayEntry.enabled) return { slots: [] };
    if (!dayEntry.slots || dayEntry.slots.length === 0) return { slots: [] };
    workStart = parseHHMM(dayEntry.slots[0].start);
    workEnd = parseHHMM(dayEntry.slots[0].end);
  }

  const { dateStart, dateEnd } = getDateRange(date, template.timezone);
  const bookings = await findByStaffAndDate(staffId, dateStart, dateEnd);

  const bookingSlots = bookings.map((b) => toBookingSlot(template, b));

  const slotStep = querySlotMode
    ? (template.slotStepMin || eventType.slotStepMin || durationMin)
    : (template.slotStepMin || eventType.slotStepMin || durationMin);

  const slotMode = querySlotMode || template.slotMode || "fixed";

  const nowMin = getNowMin(template.timezone);

  const rawSlots = getAvailableSlots({
    workStart,
    workEnd,
    duration: durationMin,
    slotStep,
    slotMode,
    bookings: bookingSlots,
    minNotice,
    nowMin,
  });

  const formatSlot = toSlotDto(durationMin);
  const slots = rawSlots.map(formatSlot);

  return { slots };
};

export { getSlotsForDate };
```

- [ ] **Step 4: Commit**

```bash
git add src/services/eventTypeServices.js src/services/scheduleServices.js src/services/slotServices.js
git commit -m "feat(booking): add eventType, schedule, and slot services"
```

---

### Task 7: Services — booking, org

**Files:**
- Create: `src/services/bookingServices.js`
- Create: `src/services/orgServices.js`

- [ ] **Step 1: Create bookingServices.js**

```js
import crypto from "crypto";
import { getEventTypeById } from "../repository/eventTypeRepository.js";
import {
  createBooking as repoCreate,
  findConflict,
  findByStaffFiltered,
  findBookingById,
  findBookingByToken,
  cancelBooking as repoCancel,
} from "../repository/bookingRepository.js";
import { findOrCreateInvitee } from "../repository/inviteeRepository.js";
import {
  createBookingNotifications,
  skipNotifications,
} from "./notificationServices.js";
import {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  HOST_ROLE,
} from "../constants/booking.js";
import { HttpError } from "../shared/utils/http/httpError.js";
import { bookingStatus } from "../shared/utils/http/httpStatus.js";

const generateToken = () => crypto.randomBytes(32).toString("hex");

const computePaymentStatus = (amount) =>
  amount > 0 ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.NONE;

const createBooking = async ({ eventTypeId, staffId, startAt, timezone, invitee }) => {
  const eventType = await getEventTypeById(eventTypeId);
  if (!eventType) return { error: "eventType_not_found" };

  const durationMs = eventType.durationMin * 60 * 1000;
  const startDate = new Date(startAt);
  const endDate = new Date(startDate.getTime() + durationMs);

  const conflict = await findConflict(staffId, startDate, endDate);
  if (conflict) throw new HttpError(bookingStatus.SLOT_TAKEN);

  const inviteeDoc = await findOrCreateInvitee(invitee);

  const amount = eventType.price ? eventType.price.amount : 0;
  const currency = eventType.price ? eventType.price.currency : "usd";

  const bookingData = {
    eventTypeId,
    hosts: [{ userId: staffId, role: HOST_ROLE.LEAD }],
    inviteeId: inviteeDoc.id,
    orgId: eventType.orgId || null,
    locationId: null,
    startAt: startDate,
    endAt: endDate,
    timezone,
    status: amount > 0 ? BOOKING_STATUS.PENDING_PAYMENT : BOOKING_STATUS.CONFIRMED,
    inviteeSnapshot: {
      name: invitee.name,
      email: invitee.email || null,
      phone: invitee.phone || null,
    },
    clientNotes: invitee.notes || null,
    payment: {
      status: computePaymentStatus(amount),
      amount,
      currency,
    },
    cancelToken: generateToken(),
    rescheduleToken: generateToken(),
  };

  const booking = await repoCreate(bookingData);

  const rawBooking = await findBookingById(booking.id);
  await createBookingNotifications(rawBooking);

  return booking;
};

const getBookingsByStaff = async (params) => {
  return findByStaffFiltered(params);
};

const cancelBookingById = async (id, reason) => {
  const booking = await findBookingById(id);
  if (!booking) return null;

  const cancelled = await repoCancel(id, reason);
  await skipNotifications(id);
  return cancelled;
};

const cancelBookingByToken = async (cancelToken, reason) => {
  const booking = await findBookingByToken(cancelToken);
  if (!booking) return null;

  const cancelled = await repoCancel(booking._id, reason);
  await skipNotifications(booking._id);
  return cancelled;
};

export { createBooking, getBookingsByStaff, cancelBookingById, cancelBookingByToken };
```

- [ ] **Step 2: Create orgServices.js**

```js
import { getOrgBySlug } from "../repository/organizationRepository.js";
import { getActiveMembersByOrg } from "../repository/membershipRepository.js";
import { getUserById } from "../modules/user/index.js";
import { getPositionById } from "../repository/positionRepository.js";
import { countConfirmedBookings } from "../repository/bookingRepository.js";
import { toOrgStaffDto } from "../dto/staffDto.js";

const getOrganizationBySlug = async (slug) => {
  return getOrgBySlug(slug);
};

const getDateRange = (dateStr) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const buildMemberProfile = async (member, dateRange) => {
  const user = await getUserById(member.userId.toString());
  if (!user) return null;

  const position = member.positionId
    ? await getPositionById(member.positionId)
    : null;

  const bookingCount = await countConfirmedBookings(
    member.userId,
    dateRange.start,
    dateRange.end,
  );

  return toOrgStaffDto(user, position, bookingCount);
};

const isNotNull = (item) => item !== null;

const getOrgStaff = async (slug, dateStr) => {
  const org = await getOrgBySlug(slug);
  if (!org) return { error: "org_not_found" };

  const members = await getActiveMembersByOrg(org.id);
  const dateRange = getDateRange(dateStr);

  const profiles = await Promise.all(
    members.map((member) => buildMemberProfile(member, dateRange)),
  );

  return { staff: profiles.filter(isNotNull) };
};

export { getOrganizationBySlug, getOrgStaff };
```

- [ ] **Step 3: Commit**

```bash
git add src/services/bookingServices.js src/services/orgServices.js
git commit -m "feat(booking): add booking and organization services"
```

---

### Task 8: Controllers

**Files:**
- Create: `src/controllers/staffController.js`
- Create: `src/controllers/eventTypeController.js`
- Create: `src/controllers/scheduleController.js`
- Create: `src/controllers/slotController.js`
- Create: `src/controllers/bookingController.js`
- Create: `src/controllers/orgController.js`

- [ ] **Step 1: Create staffController.js**

```js
import { getStaffProfile } from "../services/staffServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const handleGetStaff = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const staff = await getStaffProfile(req.params.id);
    if (!staff) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, staff);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetStaff };
```

- [ ] **Step 2: Create eventTypeController.js**

```js
import { getEventTypesForStaff } from "../services/eventTypeServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const handleGetEventTypes = async (req, res) => {
  try {
    const { staffId } = req.query;
    if (!staffId || !isValidObjectId(staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const eventTypes = await getEventTypesForStaff(staffId);
    return httpResponse(res, generalStatus.SUCCESS, eventTypes);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetEventTypes };
```

- [ ] **Step 3: Create scheduleController.js**

```js
import { getActiveTemplate, rotateTemplate, upsertScheduleOverride } from "../services/scheduleServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const handleGetTemplate = async (req, res) => {
  try {
    const { staffId, orgId, locationId } = req.query;
    if (!staffId || !isValidObjectId(staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const template = await getActiveTemplate(staffId, orgId || null, locationId || null, today);
    if (!template) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, template);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const putTemplateSchema = {
  staffId: { type: "string", required: true },
  weeklyHours: { type: "array", required: true },
  slotMode: { type: "string", required: false },
  slotStepMin: { type: "number", required: true },
};

const handlePutTemplate = async (req, res) => {
  try {
    const validated = validateSchema(putTemplateSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const template = await rotateTemplate(req.body);
    return httpResponse(res, generalStatus.SUCCESS, template);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const overrideSchema = {
  staffId: { type: "string", required: true },
  date: { type: "string", required: true },
  enabled: { type: "boolean", required: true },
};

const handlePostOverride = async (req, res) => {
  try {
    const validated = validateSchema(overrideSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const override = await upsertScheduleOverride(req.body);
    return httpResponse(res, generalStatus.SUCCESS, override);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetTemplate, handlePutTemplate, handlePostOverride };
```

- [ ] **Step 4: Create slotController.js**

```js
import { getSlotsForDate } from "../services/slotServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const handleGetSlots = async (req, res) => {
  try {
    const { staffId, eventTypeId, date, locationId, slotMode } = req.query;

    if (!staffId || !isValidObjectId(staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!eventTypeId || !isValidObjectId(eventTypeId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!date) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const result = await getSlotsForDate({ staffId, eventTypeId, date, locationId, slotMode });

    if (result.error === "eventType_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    if (result.error === "template_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }

    return httpResponse(res, generalStatus.SUCCESS, result.slots);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetSlots };
```

- [ ] **Step 5: Create bookingController.js**

```js
import {
  createBooking,
  getBookingsByStaff,
  cancelBookingById,
  cancelBookingByToken,
} from "../services/bookingServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const createBookingSchema = {
  eventTypeId: { type: "string", required: true },
  staffId: { type: "string", required: true },
  startAt: { type: "string", required: true },
  timezone: { type: "string", required: true },
  invitee: {
    type: "object",
    required: true,
    properties: {
      name: { type: "string", required: true },
      email: { type: "string", required: false },
      phone: { type: "string", required: false },
    },
  },
};

const handleCreateBooking = async (req, res) => {
  try {
    const validated = validateSchema(createBookingSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const booking = await createBooking(req.body);
    if (booking.error === "eventType_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }

    return httpResponse(res, { status: 201, message: "created" }, booking);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleGetBookingsByStaff = async (req, res) => {
  try {
    const { staffId, dateFrom, dateTo, locationId, status } = req.query;

    if (!staffId || !isValidObjectId(staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!dateFrom || !dateTo) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const statuses = status ? status.split(",") : undefined;

    const bookings = await getBookingsByStaff({
      staffId,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      locationId: locationId || undefined,
      statuses,
    });

    return httpResponse(res, generalStatus.SUCCESS, bookings);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeleteBooking = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const reason = req.body ? req.body.reason : undefined;
    const booking = await cancelBookingById(req.params.id, reason);
    if (!booking) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, booking);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const cancelByTokenSchema = {
  cancelToken: { type: "string", required: true },
  reason: { type: "string", required: false },
};

const handleCancelByToken = async (req, res) => {
  try {
    const validated = validateSchema(cancelByTokenSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const booking = await cancelBookingByToken(req.body.cancelToken, req.body.reason);
    if (!booking) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, booking);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export {
  handleCreateBooking,
  handleGetBookingsByStaff,
  handleDeleteBooking,
  handleCancelByToken,
};
```

- [ ] **Step 6: Create orgController.js**

```js
import { getOrganizationBySlug, getOrgStaff } from "../services/orgServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";

const handleGetOrg = async (req, res) => {
  try {
    const org = await getOrganizationBySlug(req.params.slug);
    if (!org) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, org);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleGetOrgStaff = async (req, res) => {
  try {
    const result = await getOrgStaff(req.params.slug, req.query.date);
    if (result.error === "org_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }

    return httpResponse(res, generalStatus.SUCCESS, result.staff);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetOrg, handleGetOrgStaff };
```

- [ ] **Step 7: Commit**

```bash
git add src/controllers/
git commit -m "feat(booking): add controllers for all booking system endpoints"
```

---

### Task 9: Routes and wiring

**Files:**
- Create: `src/routes/subroutes/staffRoutes.js`
- Create: `src/routes/subroutes/eventTypeRoutes.js`
- Create: `src/routes/subroutes/scheduleRoutes.js`
- Create: `src/routes/subroutes/slotRoutes.js`
- Create: `src/routes/subroutes/bookingRoutes.js`
- Create: `src/routes/subroutes/orgRoutes.js`
- Modify: `src/routes/routes.js`

- [ ] **Step 1: Create staffRoutes.js**

```js
import express from "express";
import { handleGetStaff } from "../../controllers/staffController.js";

const router = express.Router();

router.get("/:id", handleGetStaff);

export default router;
```

- [ ] **Step 2: Create eventTypeRoutes.js**

```js
import express from "express";
import { handleGetEventTypes } from "../../controllers/eventTypeController.js";

const router = express.Router();

router.get("/", handleGetEventTypes);

export default router;
```

- [ ] **Step 3: Create scheduleRoutes.js**

```js
import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import {
  handleGetTemplate,
  handlePutTemplate,
  handlePostOverride,
} from "../../controllers/scheduleController.js";

const router = express.Router();

router.get("/template", handleGetTemplate);
router.put("/template", authMiddleware, handlePutTemplate);
router.post("/override", authMiddleware, handlePostOverride);

export default router;
```

- [ ] **Step 4: Create slotRoutes.js**

```js
import express from "express";
import { handleGetSlots } from "../../controllers/slotController.js";

const router = express.Router();

router.get("/", handleGetSlots);

export default router;
```

- [ ] **Step 5: Create bookingRoutes.js**

```js
import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import {
  handleCreateBooking,
  handleGetBookingsByStaff,
  handleDeleteBooking,
  handleCancelByToken,
} from "../../controllers/bookingController.js";

const router = express.Router();

router.post("/", handleCreateBooking);
router.get("/by-staff", authMiddleware, handleGetBookingsByStaff);
router.delete("/:id", authMiddleware, handleDeleteBooking);
router.post("/cancel-by-token", handleCancelByToken);

export default router;
```

- [ ] **Step 6: Create orgRoutes.js**

```js
import express from "express";
import { handleGetOrg, handleGetOrgStaff } from "../../controllers/orgController.js";

const router = express.Router();

router.get("/:slug", handleGetOrg);
router.get("/:slug/staff", handleGetOrgStaff);

export default router;
```

- [ ] **Step 7: Update routes.js**

Add imports and mount points to `src/routes/routes.js`:

```js
import staffRoutes from "./subroutes/staffRoutes.js";
import eventTypeRoutes from "./subroutes/eventTypeRoutes.js";
import scheduleRoutes from "./subroutes/scheduleRoutes.js";
import slotRoutes from "./subroutes/slotRoutes.js";
import bookingRoutes from "./subroutes/bookingRoutes.js";
import orgRoutes from "./subroutes/orgRoutes.js";
```

Mount after existing routes:

```js
router.use("/staff", staffRoutes);
router.use("/event-types", eventTypeRoutes);
router.use("/schedule", scheduleRoutes);
router.use("/slots", slotRoutes);
router.use("/bookings", bookingRoutes);
router.use("/org", orgRoutes);
```

- [ ] **Step 8: Verify the server starts**

```bash
npm start
```

Expected: Server starts without import errors. If there are issues, fix import paths.

- [ ] **Step 9: Commit**

```bash
git add src/routes/
git commit -m "feat(booking): add routes and wire up all booking system endpoints"
```

---

### Task 10: Smoke test all endpoints

- [ ] **Step 1: Start the server and test health check**

```bash
curl http://localhost:3000/api/
```

Expected: 200 response.

- [ ] **Step 2: Test GET /staff/:id with a non-existent ID**

```bash
curl http://localhost:3000/api/staff/507f1f77bcf86cd799439011
```

Expected: 404 response.

- [ ] **Step 3: Test GET /event-types without staffId**

```bash
curl http://localhost:3000/api/event-types
```

Expected: 400 response.

- [ ] **Step 4: Test GET /slots without required params**

```bash
curl http://localhost:3000/api/slots
```

Expected: 400 response.

- [ ] **Step 5: Test POST /bookings/cancel-by-token with invalid token**

```bash
curl -X POST http://localhost:3000/api/bookings/cancel-by-token \
  -H "Content-Type: application/json" \
  -d '{"cancelToken": "nonexistent"}'
```

Expected: 404 response.

- [ ] **Step 6: Test GET /org/nonexistent**

```bash
curl http://localhost:3000/api/org/nonexistent
```

Expected: 404 response.

- [ ] **Step 7: Fix any issues found during smoke testing**

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(booking): complete booking system API — 12 endpoints"
```
