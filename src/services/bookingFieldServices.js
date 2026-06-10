import {
  findByOwner,
  findOrgLevelFields,
  findByEventType,
  findById,
  createField,
  updateField,
  deleteField,
} from "../repository/bookingFieldRepository.js";
import { getEventTypeById } from "../repository/eventTypeRepository.js";
import { toBookingFieldDto } from "../dto/bookingFieldDto.js";

const getFields = async (ownerId, ownerType, eventTypeId) => {
  const docs = await findByOwner(ownerId, ownerType, eventTypeId);
  return docs.map(toBookingFieldDto);
};

const createBookingField = async (data) => {
  const doc = await createField(data);
  return toBookingFieldDto(doc);
};

const updateBookingField = async (id, update) => {
  const doc = await updateField(id, update);
  if (!doc) return null;
  return toBookingFieldDto(doc);
};

const deleteBookingField = async (id) => {
  const doc = await deleteField(id);
  return doc !== null;
};

const getMergedForm = async (eventTypeId) => {
  const eventType = await getEventTypeById(eventTypeId);
  if (!eventType) return null;

  const ownerId = eventType.orgId || eventType.userId;
  const ownerType = eventType.orgId ? "org" : "user";

  const orgFields = await findOrgLevelFields(ownerId, ownerType);
  const etFields = await findByEventType(eventTypeId);

  const toDto = (doc) => toBookingFieldDto(doc);
  const customFields = [...orgFields.map(toDto), ...etFields.map(toDto)];

  return {
    baseFields: { name: { required: true } },
    customFields,
  };
};

export { getFields, createBookingField, updateBookingField, deleteBookingField, getMergedForm };
