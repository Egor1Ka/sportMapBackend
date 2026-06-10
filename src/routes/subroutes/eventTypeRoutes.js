import express from "express";
import {
  handleGetEventTypes,
  handleGetStaffForEventType,
  handleCreateEventType,
  handleUpdateEventType,
  handleDeleteEventType,
  handleUploadServicePhoto,
  handleDeleteServicePhoto,
} from "../../controllers/eventTypeController.js";
import {
  handleGetPricing,
  handleSyncPricing,
} from "../../controllers/positionPricingController.js";
import { authMiddleware } from "../../modules/auth/index.js";
import { requireOrgAdmin } from "../../middleware/orgMiddleware.js";
import { getEventTypeById } from "../../repository/eventTypeRepository.js";
import { httpResponse } from "../../shared/utils/http/httpResponse.js";
import { generalStatus } from "../../shared/utils/http/httpStatus.js";
import {
  uploadFor,
  handleUploadError,
  ASSET_TYPES,
} from "../../modules/media/index.js";

const router = express.Router();

const getOrgIdFromBody = (req) => req.body.orgId;

const requireOrgAdminIfOrg = (req, res, next) => {
  if (req.body.orgId) {
    return requireOrgAdmin(getOrgIdFromBody)(req, res, next);
  }
  next();
};

// Middleware: подтягивает orgId из EventType в req и вызывает requireOrgAdmin
const requireOrgAdminFromEventType = async (req, res, next) => {
  try {
    const eventType = await getEventTypeById(req.params.id);
    if (!eventType || !eventType.orgId) {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    req.eventTypeOrgId = eventType.orgId.toString();
    return requireOrgAdmin((r) => r.eventTypeOrgId)(req, res, next);
  } catch (error) {
    return httpResponse(res, generalStatus.ERROR);
  }
};

router.get("/", handleGetEventTypes);
router.get("/:id/staff", handleGetStaffForEventType);
router.get("/:id/position-pricing", handleGetPricing);
router.put("/:id/position-pricing", authMiddleware, requireOrgAdminFromEventType, handleSyncPricing);
router.post("/", authMiddleware, requireOrgAdminIfOrg, handleCreateEventType);
router.patch("/:id", authMiddleware, handleUpdateEventType);
router.delete("/:id", authMiddleware, handleDeleteEventType);

router.post(
  "/:id/photo",
  authMiddleware,
  uploadFor(ASSET_TYPES.SERVICE_PHOTO).single("file"),
  handleUploadError,
  handleUploadServicePhoto,
);

router.delete(
  "/:id/photo",
  authMiddleware,
  handleDeleteServicePhoto,
);

export default router;
