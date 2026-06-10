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
