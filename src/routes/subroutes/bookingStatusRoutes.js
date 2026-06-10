import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import {
  handleGetStatuses,
  handleCreateStatus,
  handleUpdateStatus,
  handleArchiveStatus,
  handleRestoreStatus,
} from "../../controllers/bookingStatusController.js";

const router = express.Router();

router.get("/", authMiddleware, handleGetStatuses);
router.post("/", authMiddleware, handleCreateStatus);
router.patch("/:id", authMiddleware, handleUpdateStatus);
router.patch("/:id/archive", authMiddleware, handleArchiveStatus);
router.patch("/:id/restore", authMiddleware, handleRestoreStatus);

export default router;
