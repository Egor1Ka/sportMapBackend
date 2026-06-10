import express from "express";
import { authMiddleware } from "../../modules/auth/index.js";
import { requireOrgAdmin, requireOrgMember } from "../../middleware/orgMiddleware.js";
import {
  handlePersonalStats,
  handleOrgStats,
  handleOrgSelfStats,
} from "../../controllers/statsController.js";

const router = express.Router();
const orgIdFromParams = (req) => req.params.orgId;

router.get("/personal",      authMiddleware, handlePersonalStats);
router.get("/org/:orgId",    authMiddleware, requireOrgAdmin(orgIdFromParams),  handleOrgStats);
router.get("/org/:orgId/me", authMiddleware, requireOrgMember(orgIdFromParams), handleOrgSelfStats);

export default router;
