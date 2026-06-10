import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import {
  handleCreateBooking,
  handleGetBookingsByStaff,
  handleDeleteBooking,
  handleCancelByToken,
  handleGetBookingById,
  handleUpdateStatus,
  handleReschedule,
} from "../../controllers/bookingController.js";

const router = express.Router();

// Public — client booking flow
router.post("/", handleCreateBooking);
router.post("/cancel-by-token", handleCancelByToken);
router.get("/by-staff", handleGetBookingsByStaff);
router.get("/:id", handleGetBookingById);

// Protected — staff/admin operations
router.patch("/:id/status", authMiddleware, handleUpdateStatus);
router.patch("/:id/reschedule", authMiddleware, handleReschedule);
router.delete("/:id", authMiddleware, handleDeleteBooking);

export default router;
