import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import {
  handleListComments,
  handleCreateComment,
  handleUpdateComment,
  handleDeleteComment,
} from "../../controllers/commentController.js";

const router = express.Router();

router.get("/:targetType/:targetId", handleListComments);
router.post("/:targetType/:targetId", authMiddleware, handleCreateComment);
router.patch("/:id", authMiddleware, handleUpdateComment);
router.delete("/:id", authMiddleware, handleDeleteComment);

export default router;
