import Position from "../models/Position.js";
import { toPositionDto } from "../dto/positionDto.js";

const getPositionById = async (id) => {
  const doc = await Position.findById(id);
  if (!doc) return null;
  return toPositionDto(doc);
};

const getPositionsByOrgId = async (orgId) => {
  const docs = await Position.find({ orgId }).sort({ level: -1, name: 1 });
  return docs.map(toPositionDto);
};

const createPosition = async (data) => {
  const doc = await Position.create(data);
  return toPositionDto(doc);
};

const updatePosition = async (id, update) => {
  const doc = await Position.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return null;
  return toPositionDto(doc);
};

const deletePosition = async (id) => {
  const doc = await Position.findByIdAndDelete(id);
  if (!doc) return null;
  return toPositionDto(doc);
};

export { getPositionById, getPositionsByOrgId, createPosition, updatePosition, deletePosition };
