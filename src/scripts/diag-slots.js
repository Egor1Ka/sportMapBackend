import mongoose from "mongoose";
import { getSlotsForDate } from "../services/slotServices.js";
import { findByStaffAndDate } from "../repository/bookingRepository.js";
import { getEventTypeById } from "../repository/eventTypeRepository.js";
import { findActiveTemplate } from "../repository/scheduleTemplateRepository.js";
import { getTimezoneOffsetMin } from "../shared/utils/timezone.js";

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/myDatabase";

const STAFF_ID = "69dca044e13b5844de83696f";
const EVENT_TYPE_ID = "69dca089e13b5844de836989";
const DATE = "2026-04-16";

const run = async () => {
  await mongoose.connect(DB_URL);

  console.log(`\n=== REQUEST ===`);
  console.log({ staffId: STAFF_ID, eventTypeId: EVENT_TYPE_ID, date: DATE });

  const dayStart = new Date(Date.UTC(2026, 3, 16, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(2026, 3, 16, 23, 59, 59, 999));
  const dateStart = new Date(dayStart.getTime() - 180 * 60000);
  const dateEnd = new Date(dayEnd.getTime() - 180 * 60000);

  console.log(`\n=== BOOKINGS for staff on ${DATE} (via repo) ===`);
  console.log({ dateStart: dateStart.toISOString(), dateEnd: dateEnd.toISOString() });
  const bookings = await findByStaffAndDate(STAFF_ID, dateStart, dateEnd);
  console.log(`Found ${bookings.length} active bookings:`);
  bookings.forEach((b) => {
    console.log({
      _id: b._id.toString(),
      status: b.status,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      durationMin: (b.endAt.getTime() - b.startAt.getTime()) / 60000,
    });
  });

  console.log(`\n=== EVENT TYPE ===`);
  const et = await getEventTypeById(EVENT_TYPE_ID);
  console.log({
    id: et._id.toString(),
    name: et.name,
    durationMin: et.durationMin,
    slotStepMin: et.slotStepMin,
    bufferAfter: et.bufferAfter,
    minNotice: et.minNotice,
    orgId: et.orgId ? et.orgId.toString() : null,
  });

  console.log(`\n=== TEMPLATE ===`);
  const tpl = await findActiveTemplate(STAFF_ID, undefined, null, new Date(DATE));
  console.log({
    id: tpl?._id?.toString(),
    timezone: tpl?.timezone,
    slotStepMin: tpl?.slotStepMin,
    slotMode: tpl?.slotMode,
    weeklyHours: tpl?.weeklyHours?.map((wh) => ({ day: wh.day, enabled: wh.enabled, slots: wh.slots })),
    orgId: tpl?.orgId ? tpl.orgId.toString() : null,
    locationId: tpl?.locationId ? tpl.locationId.toString() : null,
  });

  console.log(`\n=== BOOKING SLOTS (as engine sees them) ===`);
  const bufferAfter = et.bufferAfter || 0;
  bookings.forEach((b) => {
    const startDate = new Date(b.startAt);
    const tzOffset = getTimezoneOffsetMin(startDate, tpl.timezone);
    const startMin = startDate.getUTCHours() * 60 + startDate.getUTCMinutes() + tzOffset;
    const durationMs = b.endAt.getTime() - b.startAt.getTime();
    const duration = Math.round(durationMs / 60000) + bufferAfter;
    console.log({ _id: b._id.toString(), startMin, duration, tzOffset });
  });

  console.log(`\n=== SLOT SERVICE RESULT ===`);
  const result = await getSlotsForDate({
    staffId: STAFF_ID,
    eventTypeId: EVENT_TYPE_ID,
    date: DATE,
  });
  if (result.error) {
    console.log(`ERROR: ${result.error}`);
  } else {
    console.log(`Returned ${result.slots.length} slots:`);
    result.slots.forEach((s) => console.log(s));
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
