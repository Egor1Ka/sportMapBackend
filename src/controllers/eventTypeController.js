import { getEventTypesForStaff, getEventTypesByOrg } from "../services/eventTypeServices.js";
import { getStaffForEventType } from "../services/eventTypeStaffServices.js";
import {
  createEventType,
  createPersonalEventType,
  updateEventType,
  updateEventTypeImage,
  deleteEventType,
} from "../services/eventTypeService.js";
import { getEventTypeById } from "../repository/eventTypeRepository.js";
import { uploadAvatar, deleteAvatar, ASSET_TYPES } from "../modules/media/index.js";
import Membership from "../models/Membership.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus, userStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";

const handleGetEventTypes = async (req, res) => {
  try {
    const { staffId, orgId } = req.query;

    if (orgId && isValidObjectId(orgId) && !staffId) {
      const eventTypes = await getEventTypesByOrg(orgId);
      return httpResponse(res, generalStatus.SUCCESS, eventTypes);
    }

    if (staffId && isValidObjectId(staffId)) {
      const eventTypes = await getEventTypesForStaff(staffId, orgId || undefined);
      return httpResponse(res, generalStatus.SUCCESS, eventTypes);
    }

    return httpResponse(res, generalStatus.BAD_REQUEST);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

// Обработчик GET /event-types/:id/staff — возвращает сотрудников для типа события
const handleGetStaffForEventType = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const result = await getStaffForEventType(id);
    if (result.error) {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }

    return httpResponse(res, generalStatus.SUCCESS, result.staff);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const createEventTypeSchema = {
  name: { type: "string", required: true },
  durationMin: { type: "number", required: true },
  price: { type: "number", required: true },
  color: { type: "string", required: false },
  description: { type: "string", required: false },
  staffPolicy: { type: "string", required: false, defaultValue: "any" },
  assignedPositions: {
    type: "array",
    required: false,
    items: { type: "string" },
  },
  assignedStaff: {
    type: "array",
    required: false,
    items: { type: "string" },
  },
};

const updateEventTypeSchema = {
  name: { type: "string", required: false },
  durationMin: { type: "number", required: false },
  price: { type: "number", required: false },
  color: { type: "string", required: false },
  description: { type: "string", required: false },
  staffPolicy: { type: "string", required: false },
  assignedPositions: {
    type: "array",
    required: false,
    items: { type: "string" },
  },
  assignedStaff: {
    type: "array",
    required: false,
    items: { type: "string" },
  },
};

const handleCreateEventType = async (req, res) => {
  try {
    const validated = validateSchema(createEventTypeSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, {
        errors: validated.errors,
      });
    }

    const { orgId, userId } = req.body;

    if (orgId && isValidObjectId(orgId)) {
      const eventType = await createEventType(orgId, validated);
      return httpResponse(res, generalStatus.CREATED, eventType);
    }

    if (userId && isValidObjectId(userId)) {
      const eventType = await createPersonalEventType(userId, validated);
      return httpResponse(res, generalStatus.CREATED, eventType);
    }

    return httpResponse(res, generalStatus.BAD_REQUEST);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUpdateEventType = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const validated = validateSchema(updateEventTypeSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, {
        errors: validated.errors,
      });
    }

    const eventType = await updateEventType(req.params.id, validated);
    return httpResponse(res, generalStatus.SUCCESS, eventType);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeleteEventType = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    await deleteEventType(req.params.id);
    return httpResponse(res, generalStatus.SUCCESS);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const ADMIN_ROLES = ["owner", "admin"];

/**
 * Авторизация загрузки/удаления фото услуги.
 * - Org-услуга (`type === 'org'`): caller — owner/admin орг с eventType.orgId.
 * - Solo-услуга (`type === 'solo'`): caller — сам владелец (`userId === req.user.id`).
 */
const canEditServicePhoto = async (currentUserId, eventType) => {
  if (eventType.type === "solo") {
    return String(eventType.userId) === String(currentUserId);
  }
  if (eventType.type === "org") {
    if (!eventType.orgId) return false;
    const membership = await Membership.findOne({
      userId: currentUserId,
      orgId: eventType.orgId,
      status: "active",
    });
    return Boolean(membership && ADMIN_ROLES.includes(membership.role));
  }
  return false;
};

const handleUploadServicePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const eventType = await getEventTypeById(id);
    if (!eventType) {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }

    const allowed = await canEditServicePhoto(req.user.id, eventType);
    if (!allowed) {
      return httpResponse(res, generalStatus.UNAUTHORIZED);
    }

    if (!req.file) {
      return httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: { file: { error: "File is required" } },
      });
    }

    const { url } = await uploadAvatar({
      assetType: ASSET_TYPES.SERVICE_PHOTO,
      ownerId: id,
      file: req.file,
    });

    const result = await updateEventTypeImage(id, url);
    if (!result) return httpResponse(res, generalStatus.NOT_FOUND);
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeleteServicePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const eventType = await getEventTypeById(id);
    if (!eventType) {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }

    const allowed = await canEditServicePhoto(req.user.id, eventType);
    if (!allowed) {
      return httpResponse(res, generalStatus.UNAUTHORIZED);
    }

    if (eventType.image) {
      await deleteAvatar({
        assetType: ASSET_TYPES.SERVICE_PHOTO,
        ownerId: id,
      });
    }

    const result = await updateEventTypeImage(id, "");
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export {
  handleGetEventTypes,
  handleGetStaffForEventType,
  handleCreateEventType,
  handleUpdateEventType,
  handleDeleteEventType,
  handleUploadServicePhoto,
  handleDeleteServicePhoto,
};
