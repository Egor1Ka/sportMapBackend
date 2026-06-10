import {
  createManyNotifications,
  createNotification,
  skipScheduledByBooking,
} from "../repository/notificationRepository.js";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_STATUS,
  NOTIFICATION_CHANNEL,
  HOST_ROLE,
} from "../constants/booking.js";
import User from "../modules/user/model/User.js";
import Organization from "../models/Organization.js";
import { sendMessage } from "../providers/telegramProvider.js";
import { formatNotificationMessage } from "./telegramMessageFormatter.js";
import { getOrgAdminUserIds } from "../repository/membershipRepository.js";
import { findCurrentTemplate } from "../repository/scheduleTemplateRepository.js";

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

const findLeadHost = (booking) => {
  const isLead = (host) => host.role === HOST_ROLE.LEAD;
  return booking.hosts.find(isLead) || null;
};

const toIdKey = (id) => String(id);

const dedupeIds = (ids) => {
  const seen = new Set();
  const keep = (id) => {
    const key = toIdKey(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  return ids.filter(keep);
};

const collectRecipientUserIds = async (booking) => {
  const leadHost = findLeadHost(booking);
  const adminIds = await getOrgAdminUserIds(booking.orgId);
  const candidateIds = leadHost ? [leadHost.userId, ...adminIds] : adminIds;
  return dedupeIds(candidateIds);
};

const sendBookingTelegramToUser = async (booking, type, user, staffName, orgName, orgTimezone) => {
  const text = formatNotificationMessage(type, booking, staffName, orgName, orgTimezone);
  const notificationData = {
    bookingId: booking._id,
    recipientId: user._id,
    recipientType: "staff",
    channel: NOTIFICATION_CHANNEL.TELEGRAM,
    type,
    scheduledAt: new Date(),
  };

  if (!text) {
    console.warn(`No Telegram template for notification type: ${type}`);
    return createNotification({ ...notificationData, status: NOTIFICATION_STATUS.SKIPPED });
  }

  try {
    const externalId = await sendMessage(user.telegramChatId, text);
    if (!externalId) {
      return createNotification({ ...notificationData, status: NOTIFICATION_STATUS.SKIPPED });
    }
    return createNotification({
      ...notificationData,
      status: NOTIFICATION_STATUS.SENT,
      externalId,
    });
  } catch (error) {
    console.error("Telegram notification failed:", error.message);
    return createNotification({
      ...notificationData,
      status: NOTIFICATION_STATUS.FAILED,
      attempts: 1,
    });
  }
};

const resolveStaffName = async (booking) => {
  const leadHost = findLeadHost(booking);
  if (!leadHost) return null;
  const user = await User.findById(leadHost.userId);
  return user ? user.name : null;
};

const resolveOrgContext = async (orgId) => {
  if (!orgId) return { name: null, timezone: null };
  const org = await Organization.findById(orgId);
  if (!org) return { name: null, timezone: null };
  const timezone = org.timezone || null;
  return { name: org.name, timezone };
};

const hasTelegram = (user) => !!user.telegramChatId;

const sendBookingTelegramNotifications = async (booking, type) => {
  const userIds = await collectRecipientUserIds(booking);
  if (userIds.length === 0) return [];

  const users = await User.find({
    _id: { $in: userIds },
    telegramChatId: { $ne: null },
  });
  const reachable = users.filter(hasTelegram);
  if (reachable.length === 0) return [];

  const staffName = await resolveStaffName(booking);
  const { name: orgName, timezone: orgTz } = await resolveOrgContext(booking.orgId);
  const leadHost = findLeadHost(booking);
  const leadHostId = leadHost ? leadHost.userId.toString() : null;
  const leadTemplate = leadHostId
    ? await findCurrentTemplate(leadHostId, booking.orgId ? booking.orgId.toString() : null, null)
    : null;
  const orgTimezone = leadTemplate?.timezone ?? orgTz ?? "UTC";
  const sendOne = (user) => sendBookingTelegramToUser(booking, type, user, staffName, orgName, orgTimezone);
  return Promise.all(reachable.map(sendOne));
};

export { createBookingNotifications, skipNotifications, collectRecipientUserIds, sendBookingTelegramToUser, sendBookingTelegramNotifications };
