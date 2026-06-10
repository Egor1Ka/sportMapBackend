import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import { requireOrgAdmin } from "../../middleware/orgMiddleware.js";
import {
  handleGetPositions,
  handleCreatePosition,
  handleUpdatePosition,
  handleDeletePosition,
} from "../../controllers/positionController.js";

const router = express.Router();

const getOrgIdFromBody = (req) => req.body.orgId;

router.get("/", authMiddleware, handleGetPositions);
router.post("/", authMiddleware, requireOrgAdmin(getOrgIdFromBody), handleCreatePosition);
router.patch("/:id", authMiddleware, handleUpdatePosition);
router.delete("/:id", authMiddleware, handleDeletePosition);

export default router;
