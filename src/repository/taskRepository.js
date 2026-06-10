// ── Task Repository ─────────────────────────────────────────────────────────
// Raw database operations. No business logic here — only Mongoose calls + DTO.
// Copy this file and replace Task/toTaskDto with your own model and DTO.

import Task from "../models/Task.js";
import { toTaskDto } from "../dto/taskDto.js";

const createTask = async (data) => {
  const doc = await Task.create(data);
  return toTaskDto(doc);
};

const getTaskById = async (id) => {
  const doc = await Task.findById(id);
  if (!doc) return null;
  return toTaskDto(doc);
};

const getTasksByUserId = async (userId) => {
  const docs = await Task.find({ userId }).sort({ createdAt: -1 });
  return docs.map(toTaskDto);
};

const updateTask = async (id, update) => {
  const doc = await Task.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return null;
  return toTaskDto(doc);
};

const deleteTask = async (id) => {
  const doc = await Task.findByIdAndDelete(id);
  if (!doc) return null;
  return toTaskDto(doc);
};

export { createTask, getTaskById, getTasksByUserId, updateTask, deleteTask };
