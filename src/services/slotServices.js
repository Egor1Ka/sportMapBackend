import { getEventTypeById } from "../repository/eventTypeRepository.js";
import { findActiveTemplate } from "../repository/scheduleTemplateRepository.js";
import { findOverrideByDate } from "../repository/scheduleOverrideRepository.js";
import { findByStaffAndDate } from "../repository/bookingRepository.js";
import { getAvailableSlots } from "../shared/utils/slotEngine.js";
import { toSlotDto } from "../dto/slotDto.js";
import { getTimezoneOffsetMin, getDayOfWeekInTz, resolveScheduleTimezone, getOrgTimezone } from "../shared/utils/timezone.js";

const parseHHMM = (str) => {
  const [hh, mm] = str.split(":").map(Number);
  return hh * 60 + mm;
};

const toBookingSlot = (timezone, bufferAfter, booking, dateStart, dateEnd) => {
  const effectiveStart = booking.startAt < dateStart ? dateStart : booking.startAt;
  const effectiveEnd = booking.endAt > dateEnd ? dateEnd : booking.endAt;
  const tzOffset = getTimezoneOffsetMin(effectiveStart, timezone);
  const startMin =
    effectiveStart.getUTCHours() * 60 + effectiveStart.getUTCMinutes() + tzOffset;
  const durationMs = effectiveEnd.getTime() - effectiveStart.getTime();
  const duration = Math.round(durationMs / 60000) + bufferAfter;
  return { startMin, duration };
};

const resolveWorkWindow = (override, template, dayOfWeek) => {
  if (override && override.enabled) {
    if (!override.slots || override.slots.length === 0) return null;
    return { workStart: parseHHMM(override.slots[0].start), workEnd: parseHHMM(override.slots[0].end) };
  }
  const dayEntry = template.weeklyHours.find((wh) => wh.day === dayOfWeek);
  if (!dayEntry || !dayEntry.enabled || !dayEntry.slots || dayEntry.slots.length === 0) return null;
  return { workStart: parseHHMM(dayEntry.slots[0].start), workEnd: parseHHMM(dayEntry.slots[0].end) };
};

const getTodayStrInTz = (timezone) => {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: timezone });
};

// Cutoff for "this slot is already past" check. Сравнивается с минутами
// начала слота внутри запрошенной даты, поэтому возвращаем:
// - для прошлых дат → Infinity (все слоты считаем прошедшими)
// - для будущих дат → -Infinity (ни один слот не прошедший)
// - для сегодня → текущую минуту дня в указанной таймзоне
const getNowMin = (dateStr, timezone) => {
  const today = getTodayStrInTz(timezone);
  if (dateStr < today) return Number.POSITIVE_INFINITY;
  if (dateStr > today) return Number.NEGATIVE_INFINITY;
  const now = new Date();
  const tzOffset = getTimezoneOffsetMin(now, timezone);
  return now.getUTCHours() * 60 + now.getUTCMinutes() + tzOffset;
};

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

const getSlotsForDate = async ({ staffId, eventTypeId, date, locationId, slotMode: querySlotMode }) => {
  const eventType = await getEventTypeById(eventTypeId);
  if (!eventType) return { error: "eventType_not_found" };

  const durationMin = eventType.durationMin;
  const minNotice = eventType.minNotice || 0;

  const template = await findActiveTemplate(staffId, eventType.orgId || null, locationId || null, new Date(date));
  if (!template) return { error: "template_not_found" };

  const timezone = await resolveScheduleTimezone(template, getOrgTimezone);

  const override = await findOverrideByDate(staffId, template.orgId, template.locationId, new Date(date));

  // Полный выходной: enabled=false и нет слотов (или слоты пустые)
  const isFullDayOff = override && !override.enabled && (!override.slots || override.slots.length === 0);
  if (isFullDayOff) return { slots: [] };

  const dayOfWeek = getDayOfWeekInTz(date, timezone);

  // Частичный выходной: enabled=false со слотами = перерыв (недоступен в указанные часы)
  const isPartialDayOff = override && !override.enabled && override.slots && override.slots.length > 0;

  const workWindow = isPartialDayOff
    ? resolveWorkWindow(null, template, dayOfWeek)
    : resolveWorkWindow(override, template, dayOfWeek);
  if (!workWindow) return { slots: [] };
  const { workStart, workEnd } = workWindow;

  const bufferAfter = eventType.bufferAfter || 0;

  const { dateStart, dateEnd } = getDateRange(date, timezone);
  const bookings = await findByStaffAndDate(staffId, dateStart, dateEnd, eventType.orgId || null);

  const toBooking = (b) => toBookingSlot(timezone, bufferAfter, b, dateStart, dateEnd);
  const bookingSlots = bookings.map(toBooking);

  // Добавляем перерыв как фейковый букинг чтобы slot engine его заблокировал
  if (isPartialDayOff) {
    const toBreakBooking = (slot) => ({
      startMin: parseHHMM(slot.start),
      duration: parseHHMM(slot.end) - parseHHMM(slot.start),
    });
    const breakSlots = override.slots.map(toBreakBooking);
    bookingSlots.push(...breakSlots);
  }

  const slotStep = template.slotStepMin || eventType.slotStepMin || durationMin;

  const slotMode = querySlotMode || template.slotMode || "fixed";

  const nowMin = getNowMin(date, timezone);

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

export { getSlotsForDate, getDateRangeForTest };
