import PositionPricing from "../models/PositionPricing.js";

const findByEventType = async (eventTypeId) => {
  return PositionPricing.find({ eventTypeId });
};

const findByEventTypeAndPosition = async (eventTypeId, positionId) => {
  return PositionPricing.findOne({ eventTypeId, positionId });
};

const upsertPricing = async ({ orgId, eventTypeId, positionId, price }) => {
  return PositionPricing.findOneAndUpdate(
    { eventTypeId, positionId },
    { orgId, price },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

const deletePricing = async (eventTypeId, positionId) => {
  return PositionPricing.deleteOne({ eventTypeId, positionId });
};

const deleteAllForEventType = async (eventTypeId) => {
  return PositionPricing.deleteMany({ eventTypeId });
};

export { findByEventType, findByEventTypeAndPosition, upsertPricing, deletePricing, deleteAllForEventType };
