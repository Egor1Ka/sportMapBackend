// ── Task Services ───────────────────────────────────────────────────────────
// Business logic layer. Orchestrates repository calls and applies rules.
// Keep pure logic separate from side effects (DB calls).
// Copy this file and replace with your own entity's logic.

import {
  createTask as repoCreateTask,
  getTaskById as repoGetTaskById,
  getTasksByUserId as repoGetTasksByUserId,
  updateTask as repoUpdateTask,
  deleteTask as repoDeleteTask,
} from "../repository/taskRepository.js";

const createTask = async (userId, data) => {
  return repoCreateTask({ ...data, userId });
};

const getTaskById = async (id) => {
  return repoGetTaskById(id);
};

const getTasksByUserId = async (userId) => {
  return repoGetTasksByUserId(userId);
};

const updateTask = async (id, update) => {
  return repoUpdateTask(id, update);
};

const deleteTask = async (id) => {
  return repoDeleteTask(id);
};

export { createTask, getTaskById, getTasksByUserId, updateTask, deleteTask };
