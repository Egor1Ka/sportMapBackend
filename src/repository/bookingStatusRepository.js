import BookingStatus from "../models/BookingStatus.js";
import { toBookingStatusDto } from "../dto/bookingStatusDto.js";
import { BOOKING_STATUS_ACTIONS } from "../constants/bookingStatus.js";

const createStatus = async (data) => {
  const doc = await BookingStatus.create(data);
  return toBookingStatusDto(doc);
};

const createManyStatuses = async (dataArray) => {
  const docs = await BookingStatus.insertMany(dataArray);
  return docs.map(toBookingStatusDto);
};

const findByScope = async (orgId, userId = null) => {
  const query = orgId
    ? { orgId, isArchived: false }
    : { userId, orgId: null, isArchived: false };
  const docs = await BookingStatus.find(query).sort({ order: 1 });
  return docs.map(toBookingStatusDto);
};

const findById = async (id) => {
  const doc = await BookingStatus.findById(id);
  return doc ? toBookingStatusDto(doc) : null;
};

const findRawById = async (id) => {
  return BookingStatus.findById(id);
};

const updateStatus = async (id, updates) => {
  const doc = await BookingStatus.findByIdAndUpdate(id, updates, { new: true });
  return doc ? toBookingStatusDto(doc) : null;
};

const findByLabel = async (label, orgId, userId = null) => {
  const query = orgId
    ? { label, orgId }
    : { label, userId, orgId: null };
  const doc = await BookingStatus.findOne(query);
  return doc ? toBookingStatusDto(doc) : null;
};

const getHiddenStatusIds = async (orgId, userId = null) => {
  const query = orgId
    ? { orgId, actions: BOOKING_STATUS_ACTIONS.HIDE_FROM_SCHEDULE }
    : { userId, orgId: null, actions: BOOKING_STATUS_ACTIONS.HIDE_FROM_SCHEDULE };
  return BookingStatus.find(query).distinct("_id");
};

const countByScope = async (orgId, userId = null) => {
  const query = orgId
    ? { orgId, isArchived: false }
    : { userId, orgId: null, isArchived: false };
  return BookingStatus.countDocuments(query);
};

export {
  createStatus,
  createManyStatuses,
  findByScope,
  findById,
  findRawById,
  updateStatus,
  findByLabel,
  getHiddenStatusIds,
  countByScope,
};
