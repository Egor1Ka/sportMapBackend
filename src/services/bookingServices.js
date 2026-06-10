import crypto from "crypto";
import { getEventTypeById } from "../repository/eventTypeRepository.js";
import { getMembershipByUserAndOrg } from "../repository/membershipRepository.js";
import { findActiveTemplate } from "../repository/scheduleTemplateRepository.js";
import { resolvePriceForStaff } from "./positionPricingServices.js";
import {
  createBooking as repoCreate,
  findConflict,
  findByStaffFiltered,
  findBookingById,
  findBookingByToken,
  cancelBooking as repoCancel,
  updateBookingStatus as repoUpdateStatus,
  rescheduleBooking as repoReschedule,
} from "../repository/bookingRepository.js";
import { toBookingDto } from "../dto/bookingDto.js";
import { findOrCreateInvitee } from "../repository/inviteeRepository.js";
import {
  createBookingNotifications,
  skipNotifications,
  sendBookingTelegramNotifications,
} from "./notificationServices.js";
import {
  PAYMENT_STATUS,
  HOST_ROLE,
  NOTIFICATION_TYPE,
} from "../constants/booking.js";
import {
  BOOKING_STATUS_ACTIONS,
} from "../constants/bookingStatus.js";
import {
  findByLabel,
  getHiddenStatusIds,
} from "../repository/bookingStatusRepository.js";
import { HttpError } from "../shared/utils/http/httpError.js";
import { bookingStatus } from "../shared/utils/http/httpStatus.js";
import { parseWallClockToUtc, isValidTimezone, resolveScheduleTimezone, getOrgTimezone } from "../shared/utils/timezone.js";
import Organization from "../models/Organization.js";
import User from "../modules/user/model/User.js";

const generateToken = () => crypto.randomBytes(32).toString("hex");

const computePaymentStatus = (amount) =>
  amount > 0 ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.NONE;

/**
 * Получить defaultBookingStatusId для scope.
 */
const resolveDefaultStatusId = async (orgId, userId) => {
  if (orgId) {
    const org = await Organization.findById(orgId).select("defaultBookingStatusId");
    return org ? org.defaultBookingStatusId : null;
  }
  const user = await User.findById(userId).select("defaultBookingStatusId");
  return user ? user.defaultBookingStatusId : null;
};

/**
 * Найти статус с действием hideFromSchedule (для отмены).
 */
const resolveCancelStatusId = async (orgId, userId) => {
  const hiddenIds = await getHiddenStatusIds(orgId, orgId ? null : userId);
  return hiddenIds.length > 0 ? hiddenIds[0] : null;
};

const createBooking = async ({ eventTypeId, staffId, startAt, timezone, invitee, customFieldValues }) => {
  const eventType = await getEventTypeById(eventTypeId);
  if (!eventType) return { error: "eventType_not_found" };

  const clientTimezone = isValidTimezone(timezone) ? timezone : null;

  const template = await findActiveTemplate(staffId, eventType.orgId || null, null, new Date(startAt));
  if (!template) return { error: "template_not_found" };
  const gridTimezone = await resolveScheduleTimezone(template, getOrgTimezone);

  const durationMs = eventType.durationMin * 60 * 1000;
  const startDate = parseWallClockToUtc(startAt, gridTimezone);
  const endDate = new Date(startDate.getTime() + durationMs);

  const conflict = await findConflict(staffId, startDate, endDate, eventType.orgId || null);
  if (conflict) throw new HttpError(bookingStatus.SLOT_TAKEN);

  const inviteeDoc = await findOrCreateInvitee(invitee);

  const staffMembership = eventType.orgId
    ? await getMembershipByUserAndOrg(staffId, eventType.orgId)
    : null;
  const staffPositionId = staffMembership ? staffMembership.positionId : null;
  const resolvedPrice = await resolvePriceForStaff(eventType, staffPositionId);

  const amount = resolvedPrice ? resolvedPrice.amount : 0;

  // Динамический дефолтный статус вместо хардкода
  const defaultStatusId = await resolveDefaultStatusId(eventType.orgId, staffId);
  if (!defaultStatusId) {
    throw new HttpError(bookingStatus.SLOT_TAKEN);
  }

  const bookingData = {
    eventTypeId,
    hosts: [{ userId: staffId, role: HOST_ROLE.LEAD }],
    inviteeId: inviteeDoc.id,
    orgId: eventType.orgId || null,
    locationId: null,
    startAt: startDate,
    endAt: endDate,
    timezone: clientTimezone,
    statusId: defaultStatusId,
    inviteeSnapshot: {
      name: invitee.name,
      email: invitee.email || null,
      phone: invitee.phone || null,
    },
    clientNotes: invitee.notes || null,
    customFieldValues: Array.isArray(customFieldValues) ? customFieldValues : [],
    payment: {
      status: computePaymentStatus(amount),
      amount,
    },
    cancelToken: generateToken(),
    rescheduleToken: generateToken(),
  };

  const booking = await repoCreate(bookingData);

  const rawBooking = await findBookingById(booking.id);
  await createBookingNotifications(rawBooking);
  sendBookingTelegramNotifications(rawBooking, NOTIFICATION_TYPE.BOOKING_CONFIRMED).catch((error) =>
    console.error("Telegram notification error:", error.message),
  );

  return { raw: rawBooking, eventType };
};

const getBookingsByStaff = async (params) => {
  return findByStaffFiltered(params);
};

const cancelBookingById = async (id, reason) => {
  const booking = await findBookingById(id);
  if (!booking) return null;

  const orgId = booking.orgId;
  const userId = booking.hosts[0].userId.toString();
  const cancelStatusId = await resolveCancelStatusId(orgId, orgId ? null : userId);

  if (!cancelStatusId) return null;

  const cancelled = await repoCancel(id, reason, cancelStatusId);
  await skipNotifications(id);
  sendBookingTelegramNotifications(booking, NOTIFICATION_TYPE.BOOKING_CANCELLED).catch((error) =>
    console.error("Telegram notification error:", error.message),
  );
  return cancelled;
};

const cancelBookingByToken = async (cancelToken, reason) => {
  const booking = await findBookingByToken(cancelToken);
  if (!booking) return null;

  const orgId = booking.orgId;
  const userId = booking.hosts[0].userId.toString();
  const cancelStatusId = await resolveCancelStatusId(orgId, orgId ? null : userId);

  if (!cancelStatusId) return null;

  const cancelled = await repoCancel(booking._id, reason, cancelStatusId);
  await skipNotifications(booking._id);
  sendBookingTelegramNotifications(booking, NOTIFICATION_TYPE.BOOKING_CANCELLED).catch((error) =>
    console.error("Telegram notification error:", error.message),
  );
  return cancelled;
};

const getBookingById = async (id) => {
  const booking = await findBookingById(id);
  if (!booking) return null;
  return toBookingDto(booking);
};

const updateBookingStatus = async (id, statusId) => {
  const booking = await findBookingById(id);
  if (!booking) return null;

  const result = await repoUpdateStatus(id, statusId);

  sendBookingTelegramNotifications(booking, NOTIFICATION_TYPE.BOOKING_STATUS_CHANGED).catch((error) =>
    console.error("Telegram notification error:", error.message),
  );

  return result;
};

const rescheduleBookingById = async (id, newStartAt) => {
  const booking = await findBookingById(id);
  if (!booking) return { error: "booking_not_found" };

  const eventTypeId = booking.eventTypeId?._id || booking.eventTypeId;
  const eventType = await getEventTypeById(eventTypeId.toString());
  if (!eventType) return { error: "eventType_not_found" };

  const staffId = booking.hosts[0].userId.toString();

  const template = await findActiveTemplate(staffId, eventType.orgId || null, null, new Date(newStartAt));
  if (!template) return { error: "template_not_found" };
  const gridTimezone = await resolveScheduleTimezone(template, getOrgTimezone);

  const durationMs = eventType.durationMin * 60 * 1000;
  const startDate = parseWallClockToUtc(newStartAt, gridTimezone);
  const endDate = new Date(startDate.getTime() + durationMs);

  const conflict = await findConflict(staffId, startDate, endDate, eventType.orgId || null);
  if (conflict && conflict._id.toString() !== id) {
    throw new HttpError(bookingStatus.SLOT_TAKEN);
  }

  const rescheduled = await repoReschedule(id, startDate, endDate);
  const updatedBooking = await findBookingById(id);
  sendBookingTelegramNotifications(updatedBooking, NOTIFICATION_TYPE.BOOKING_RESCHEDULED).catch((error) =>
    console.error("Telegram notification error:", error.message),
  );
  return rescheduled;
};

export {
  createBooking,
  getBookingsByStaff,
  cancelBookingById,
  cancelBookingByToken,
  getBookingById,
  updateBookingStatus,
  rescheduleBookingById,
};
