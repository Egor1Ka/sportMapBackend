// ── Task Routes ─────────────────────────────────────────────────────────────
// Route definitions for your business entity.
// Import auth middleware from the auth module via its public API.
// Import your entity's controller and middleware.
// Copy this file and replace with your own entity's routes.

import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import { requireTaskOwner } from "../../middleware/taskMiddleware.js";
import {
  handleCreateTask,
  handleGetTask,
  handleGetMyTasks,
  handleUpdateTask,
  handleDeleteTask,
} from "../../controllers/taskController.js";

const router = express.Router();

router.post("/", authMiddleware, handleCreateTask);
router.get("/my", authMiddleware, handleGetMyTasks);
router.get("/:id", authMiddleware, requireTaskOwner, handleGetTask);
router.put("/:id", authMiddleware, requireTaskOwner, handleUpdateTask);
router.delete("/:id", authMiddleware, requireTaskOwner, handleDeleteTask);

export default router;
