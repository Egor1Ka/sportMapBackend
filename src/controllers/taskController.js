// ── Task Controller ─────────────────────────────────────────────────────────
// HTTP handlers. Validate input, call services, send response.
// Import auth middleware from modules/auth for protected routes.
// Import shared utilities for responses and validation.
// Copy this file and replace with your own entity's handlers.

import {
  createTask,
  deleteTask,
  getTaskById,
  getTasksByUserId,
  updateTask,
} from "../services/taskServices.js";
import {
  httpResponse,
  httpResponseError,
} from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const createTaskSchema = {
  title: { type: "string", required: true },
  description: { type: "string", required: false },
};

const updateTaskSchema = {
  title: { type: "string", required: false },
  description: { type: "string", required: false },
  status: { type: "string", required: false },
};

const handleCreateTask = async (req, res) => {
  try {
    const validated = validateSchema(createTaskSchema, req.body);
    if (validated.errors) {
      httpResponse(res, generalStatus.BAD_REQUEST, {
        errors: validated.errors,
      });
      return;
    }

    const task = await createTask(req.user.id, validated);
    httpResponse(res, generalStatus.SUCCESS, task);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const handleGetTask = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      httpResponse(res, generalStatus.BAD_REQUEST);
      return;
    }

    const task = await getTaskById(req.params.id);
    if (!task) {
      httpResponse(res, generalStatus.NOT_FOUND);
      return;
    }

    httpResponse(res, generalStatus.SUCCESS, task);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const handleGetMyTasks = async (req, res) => {
  try {
    const tasks = await getTasksByUserId(req.user.id);
    httpResponse(res, generalStatus.SUCCESS, tasks);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const handleUpdateTask = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      httpResponse(res, generalStatus.BAD_REQUEST);
      return;
    }

    const validated = validateSchema(updateTaskSchema, req.body);
    if (validated.errors) {
      httpResponse(res, generalStatus.BAD_REQUEST, {
        errors: validated.errors,
      });
      return;
    }

    const task = await updateTask(req.params.id, validated);
    if (!task) {
      httpResponse(res, generalStatus.NOT_FOUND);
      return;
    }

    httpResponse(res, generalStatus.SUCCESS, task);
  } catch (error) {
    httpResponseError(res, error);
  }
};

const handleDeleteTask = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      httpResponse(res, generalStatus.BAD_REQUEST);
      return;
    }

    const deleted = await deleteTask(req.params.id);
    if (!deleted) {
      httpResponse(res, generalStatus.NOT_FOUND);
      return;
    }

    httpResponse(res, generalStatus.SUCCESS);
  } catch (error) {
    httpResponseError(res, error);
  }
};

export {
  handleCreateTask,
  handleDeleteTask,
  handleGetMyTasks,
  handleGetTask,
  handleUpdateTask,
};
