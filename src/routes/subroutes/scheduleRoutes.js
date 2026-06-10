import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import {
  handleGetTemplate,
  handlePutTemplate,
  handlePostOverride,
  handleGetOverrides,
  handleDeleteOverride,
  handleGetOverridesByOrg,
  handleGetTemplatesByOrg,
} from "../../controllers/scheduleController.js";

const router = express.Router();

// Public — needed for booking page calendar
router.get("/templates/by-org/:orgId", handleGetTemplatesByOrg);
router.get("/overrides/by-org/:orgId", handleGetOverridesByOrg);
router.get("/template", handleGetTemplate);
router.get("/overrides", handleGetOverrides);

// Protected — staff/admin operations
router.put("/template", authMiddleware, handlePutTemplate);
router.post("/override", authMiddleware, handlePostOverride);
router.delete("/override/:id", authMiddleware, handleDeleteOverride);

export default router;
