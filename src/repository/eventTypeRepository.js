import EventType from "../models/EventType.js";
import { toEventTypeDto } from "../dto/eventTypeDto.js";

const getEventTypeById = async (id) => {
  const doc = await EventType.findById(id);
  if (!doc) return null;
  return doc;
};

const getEventTypesForStaff = async (staffId, orgId, positionId) => {
  const orgConditions = [];
  if (orgId) {
    orgConditions.push({ orgId, staffPolicy: "any" });
    orgConditions.push({ orgId, staffPolicy: "specific", assignedStaff: staffId });
    if (positionId) {
      orgConditions.push({ orgId, staffPolicy: "by_position", assignedPositions: positionId });
    }
  }

  const query = {
    active: true,
    $or: [{ userId: staffId }, ...orgConditions],
  };
  const docs = await EventType.find(query);
  return Promise.all(docs.map(toEventTypeDto));
};

const getEventTypesByOrg = async (orgId) => {
  const docs = await EventType.find({ orgId, active: true });
  return Promise.all(docs.map(toEventTypeDto));
};

const createEventType = async (data) => {
  const doc = await EventType.create(data);
  return toEventTypeDto(doc);
};

const updateEventType = async (id, update) => {
  const doc = await EventType.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return null;
  return toEventTypeDto(doc);
};

const deleteEventType = async (id) => {
  const doc = await EventType.findByIdAndDelete(id);
  if (!doc) return null;
  return toEventTypeDto(doc);
};

export {
  getEventTypeById,
  getEventTypesForStaff,
  getEventTypesByOrg,
  createEventType,
  updateEventType,
  deleteEventType,
};
