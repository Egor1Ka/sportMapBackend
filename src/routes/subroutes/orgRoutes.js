import express from "express";
import { handleGetOrg, handleGetOrgStaff, handleCreateOrg, handleUpdateOrg, handleUpdateStaffMember, handleUpdateStaffPosition, handleGetUserOrgs, handleAddStaff, handleAcceptInvitation, handleDeclineInvitation, handleGetMyMembership, handleUploadStaffAvatar, handleDeleteStaffAvatar, handleUploadOrgLogo, handleDeleteOrgLogo } from "../../controllers/orgController.js";
import { authMiddleware } from "../../modules/auth/index.js";
import { requireOrgAdmin } from "../../middleware/orgMiddleware.js";
import { requireFeature } from "../../modules/billing/middleware/plan.js";
import { uploadFor, handleUploadError, ASSET_TYPES } from "../../modules/media/index.js";

const router = express.Router();

router.get("/user-orgs", authMiddleware, handleGetUserOrgs);
router.post("/", authMiddleware, requireFeature("createOrg"), handleCreateOrg);
router.get("/:id", handleGetOrg);
router.get("/:id/my-membership", authMiddleware, handleGetMyMembership);
router.put("/:id", authMiddleware, requireOrgAdmin((req) => req.params.id), handleUpdateOrg);
router.get("/:id/staff", handleGetOrgStaff);
router.post("/:id/staff", authMiddleware, requireOrgAdmin((req) => req.params.id), handleAddStaff);
router.patch("/:id/staff/:staffId", authMiddleware, handleUpdateStaffMember);
router.patch("/:id/staff/:staffId/position", authMiddleware, requireOrgAdmin((req) => req.params.id), handleUpdateStaffPosition);
router.patch("/:id/membership/accept", authMiddleware, handleAcceptInvitation);
router.delete("/:id/membership/decline", authMiddleware, handleDeclineInvitation);
router.post(
  "/:id/staff/:staffId/avatar",
  authMiddleware,
  uploadFor(ASSET_TYPES.STAFF_AVATAR).single("file"),
  handleUploadError,
  handleUploadStaffAvatar,
);
router.delete(
  "/:id/staff/:staffId/avatar",
  authMiddleware,
  handleDeleteStaffAvatar,
);

router.post(
  "/:id/logo",
  authMiddleware,
  requireOrgAdmin((req) => req.params.id),
  uploadFor(ASSET_TYPES.ORG_LOGO).single("file"),
  handleUploadError,
  handleUploadOrgLogo,
);

router.delete(
  "/:id/logo",
  authMiddleware,
  requireOrgAdmin((req) => req.params.id),
  handleDeleteOrgLogo,
);

export default router;
