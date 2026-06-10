import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import {
  handleGetRatingSummary,
  handleSetRating,
  handleDeleteRating,
} from "../../controllers/ratingController.js";

const router = express.Router();

router.get("/:targetType/:targetId", handleGetRatingSummary);
router.put("/:targetType/:targetId", authMiddleware, handleSetRating);
router.delete("/:targetType/:targetId", authMiddleware, handleDeleteRating);

export default router;
