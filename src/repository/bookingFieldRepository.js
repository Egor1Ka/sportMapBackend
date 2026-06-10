import BookingField from "../models/BookingField.js";

const findByOwner = async (ownerId, ownerType, eventTypeId) => {
  const query = { ownerId, ownerType };
  if (eventTypeId) query.eventTypeId = eventTypeId;
  return BookingField.find(query).sort({ createdAt: 1 });
};

const findOrgLevelFields = async (ownerId, ownerType) => {
  return BookingField.find({ ownerId, ownerType, eventTypeId: null }).sort({ createdAt: 1 });
};

const findByEventType = async (eventTypeId) => {
  return BookingField.find({ eventTypeId }).sort({ createdAt: 1 });
};

const findById = async (id) => {
  return BookingField.findById(id);
};

const createField = async (data) => {
  return BookingField.create(data);
};

const updateField = async (id, update) => {
  return BookingField.findByIdAndUpdate(id, update, { new: true });
};

const deleteField = async (id) => {
  return BookingField.findByIdAndDelete(id);
};

export { findByOwner, findOrgLevelFields, findByEventType, findById, createField, updateField, deleteField };
