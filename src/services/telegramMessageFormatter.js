import { NOTIFICATION_TYPE } from "../constants/booking.js";

const DATE_TIME_FORMAT_OPTIONS = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const formatDateTime = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat("uk-UA", {
    ...DATE_TIME_FORMAT_OPTIONS,
    timeZone: timezone || "UTC",
  });
  const parts = formatter.formatToParts(new Date(date));
  const lookup = (type) => {
    const found = parts.find((p) => p.type === type);
    return found ? found.value : "";
  };
  const day    = lookup("day");
  const month  = lookup("month");
  const year   = lookup("year");
  const hour   = lookup("hour");
  const minute = lookup("minute");
  return `${day}.${month}.${year} ${hour}:${minute}`;
};

const formatInviteeName = (booking) =>
  booking.inviteeSnapshot?.name || "Клієнт";

const formatPhone = (booking) =>
  booking.inviteeSnapshot?.phone
    ? `\n📞 ${booking.inviteeSnapshot.phone}`
    : "";

const formatEmail = (booking) =>
  booking.inviteeSnapshot?.email
    ? `\n📧 ${booking.inviteeSnapshot.email}`
    : "";

const formatContactInfo = (booking) =>
  `${formatPhone(booking)}${formatEmail(booking)}`;

const isFilledCustomField = (entry) =>
  !!entry && !!entry.label && entry.value !== undefined && entry.value !== null && entry.value !== "";

const formatCustomFieldEntry = (entry) => `\n📝 ${entry.label}: ${entry.value}`;

const formatCustomFields = (booking) => {
  const values = booking.customFieldValues;
  if (!Array.isArray(values) || values.length === 0) return "";
  return values.filter(isFilledCustomField).map(formatCustomFieldEntry).join("");
};

const formatServiceName = (booking) => {
  const name = booking.eventTypeId?.name;
  return name ? `\n💇 ${name}` : "";
};

const formatStaffName = (staffName) =>
  staffName ? `\n👨‍💼 ${staffName}` : "";

const formatOrgName = (orgName) => (orgName ? `\n🏢 ${orgName}` : "");

const formatBookingDetails = (booking, staffName, orgName, timezone) =>
  `👤 ${formatInviteeName(booking)}${formatContactInfo(booking)}${formatCustomFields(booking)}${formatServiceName(booking)}${formatStaffName(staffName)}${formatOrgName(orgName)}\n📅 ${formatDateTime(booking.startAt, timezone)}`;

const MESSAGE_TEMPLATES = {
  [NOTIFICATION_TYPE.BOOKING_CONFIRMED]: (booking, staffName, orgName, timezone) =>
    `✅ <b>Новий запис</b>\n\n${formatBookingDetails(booking, staffName, orgName, timezone)}`,

  [NOTIFICATION_TYPE.BOOKING_CANCELLED]: (booking, staffName, orgName, timezone) =>
    `❌ <b>Запис скасовано</b>\n\n${formatBookingDetails(booking, staffName, orgName, timezone)}`,

  [NOTIFICATION_TYPE.BOOKING_RESCHEDULED]: (booking, staffName, orgName, timezone) =>
    `🔄 <b>Запис перенесено</b>\n\n${formatBookingDetails(booking, staffName, orgName, timezone)}`,

  [NOTIFICATION_TYPE.BOOKING_COMPLETED]: (booking, staffName, orgName, timezone) =>
    `✔️ <b>Запис завершено</b>\n\n${formatBookingDetails(booking, staffName, orgName, timezone)}`,

  [NOTIFICATION_TYPE.BOOKING_NO_SHOW]: (booking, staffName, orgName, timezone) =>
    `🚫 <b>Клієнт не з'явився</b>\n\n${formatBookingDetails(booking, staffName, orgName, timezone)}`,

  [NOTIFICATION_TYPE.BOOKING_STATUS_CHANGED]: (booking, staffName, orgName, timezone) =>
    `🔔 <b>Статус змінено</b>\n\n${formatBookingDetails(booking, staffName, orgName, timezone)}`,
};

const formatNotificationMessage = (type, booking, staffName, orgName, timezone) => {
  const template = MESSAGE_TEMPLATES[type];
  if (!template) return null;
  return template(booking, staffName, orgName, timezone);
};

export { formatNotificationMessage };
