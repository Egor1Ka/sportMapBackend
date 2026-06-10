import Booking from "../models/Booking.js";
import { toBookingDto } from "../dto/bookingDto.js";
import { getHiddenStatusIds } from "./bookingStatusRepository.js";

const createBooking = async (data) => {
  const doc = await Booking.create(data);
  const populated = await doc.populate("statusId");
  return toBookingDto(populated);
};

const findConflict = async (staffId, startAt, endAt, orgId = null) => {
  const userId = staffId;
  const hiddenIds = await getHiddenStatusIds(orgId, orgId ? null : userId);

  const doc = await Booking.findOne({
    "hosts.userId": staffId,
    orgId: orgId || null,
    statusId: { $nin: hiddenIds },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  });
  return doc;
};

const findByStaffAndDate = async (staffId, dateStart, dateEnd, orgId = null) => {
  const hiddenIds = await getHiddenStatusIds(orgId, orgId ? null : staffId);

  const docs = await Booking.find({
    "hosts.userId": staffId,
    statusId: { $nin: hiddenIds },
    startAt: { $lt: dateEnd },
    endAt: { $gt: dateStart },
  });
  return docs;
};

const findByStaffFiltered = async ({ staffId, dateFrom, dateTo, locationId, orgId, statuses }) => {
  const query = {
    "hosts.userId": staffId,
    startAt: { $gte: dateFrom, $lte: dateTo },
  };
  if (locationId) query.locationId = locationId;
  if (orgId !== undefined) query.orgId = orgId;

  if (statuses) {
    query.statusId = { $in: statuses };
  }

  const docs = await Booking.find(query)
    .populate("statusId")
    .sort({ startAt: 1 });
  return Promise.all(docs.map(toBookingDto));
};

const findBookingById = async (id) => {
  const doc = await Booking.findById(id)
    .populate("eventTypeId", "name durationMin")
    .populate("statusId");
  return doc;
};

const findBookingByToken = async (cancelToken) => {
  const doc = await Booking.findOne({ cancelToken }).populate("statusId");
  return doc;
};

const cancelBooking = async (id, reason, cancelStatusId) => {
  const doc = await Booking.findByIdAndUpdate(
    id,
    {
      statusId: cancelStatusId,
      cancelReason: reason || null,
      cancelToken: null,
      rescheduleToken: null,
    },
    { new: true },
  ).populate("statusId");
  if (!doc) return null;
  return toBookingDto(doc);
};

const countConfirmedBookings = async (staffId, dateStart, dateEnd, orgId = null) => {
  const hiddenIds = await getHiddenStatusIds(orgId, orgId ? null : staffId);
  const count = await Booking.countDocuments({
    "hosts.userId": staffId,
    statusId: { $nin: hiddenIds },
    startAt: { $gte: dateStart, $lt: dateEnd },
  });
  return count;
};

const updateBookingStatus = async (id, statusId) => {
  const doc = await Booking.findByIdAndUpdate(
    id,
    { statusId },
    { new: true },
  ).populate("statusId");
  if (!doc) return null;
  return toBookingDto(doc);
};

const rescheduleBooking = async (id, startAt, endAt) => {
  const doc = await Booking.findByIdAndUpdate(
    id,
    { startAt, endAt },
    { new: true },
  ).populate("statusId");
  if (!doc) return null;
  return toBookingDto(doc);
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
  updateBookingStatus,
  rescheduleBooking,
};
