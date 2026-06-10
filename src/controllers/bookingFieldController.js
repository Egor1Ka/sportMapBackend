import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";
import { BOOKING_FIELD_TYPES, OWNER_TYPES } from "../models/BookingField.js";
import { requireOrgAdmin, requireOrgRole } from "../shared/utils/orgAuth.js";
import {
  getFields,
  createBookingField,
  updateBookingField,
  deleteBookingField,
  getMergedForm,
} from "../services/bookingFieldServices.js";

const isValidFieldType = (v) => BOOKING_FIELD_TYPES.includes(v);
const isValidOwnerType = (v) => OWNER_TYPES.includes(v);

const createSchema = {
  ownerId: { type: "string", required: true, validator: isValidObjectId, validatorErrorMessage: "must be a valid ObjectId" },
  ownerType: { type: "string", required: true, validator: isValidOwnerType, validatorErrorMessage: "must be org or user" },
  eventTypeId: { type: "string", required: false, validator: isValidObjectId, validatorErrorMessage: "must be a valid ObjectId" },
  type: { type: "string", required: true, validator: isValidFieldType, validatorErrorMessage: "must be email, phone, text, or textarea" },
  label: { type: "string", required: true },
  required: { type: "boolean", required: false },
};

const updateSchema = {
  label: { type: "string", required: false },
  type: { type: "string", required: false, validator: isValidFieldType, validatorErrorMessage: "must be email, phone, text, or textarea" },
  required: { type: "boolean", required: false },
};

const handleGetFields = async (req, res) => {
  try {
    const { ownerId, ownerType, eventTypeId } = req.query;

    if (!ownerId || !isValidObjectId(ownerId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!ownerType || !isValidOwnerType(ownerType)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    if (ownerType === "org") {
      await requireOrgRole(req.user.id, ownerId, ["owner", "admin", "member"]);
    } else if (ownerType === "user" && String(req.user.id) !== String(ownerId)) {
      return httpResponse(res, generalStatus.FORBIDDEN);
    }

    const fields = await getFields(ownerId, ownerType, eventTypeId || undefined);
    return httpResponse(res, generalStatus.SUCCESS, fields);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleCreateField = async (req, res) => {
  try {
    const validated = validateSchema(createSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, validated.errors);
    }

    const { ownerId, ownerType } = validated;
    if (ownerType === "org") {
      await requireOrgAdmin(req.user.id, ownerId);
    } else if (ownerType === "user" && String(req.user.id) !== String(ownerId)) {
      return httpResponse(res, generalStatus.FORBIDDEN);
    }

    const field = await createBookingField({
      ...validated,
      eventTypeId: validated.eventTypeId || null,
    });
    return httpResponse(res, generalStatus.CREATED, field);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUpdateField = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const validated = validateSchema(updateSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, validated.errors);
    }

    if (!Object.keys(validated).length) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const field = await updateBookingField(req.params.id, validated);
    if (!field) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, field);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeleteField = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const deleted = await deleteBookingField(req.params.id);
    if (!deleted) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleGetMergedForm = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.eventTypeId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const form = await getMergedForm(req.params.eventTypeId);
    if (!form) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, form);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetFields, handleCreateField, handleUpdateField, handleDeleteField, handleGetMergedForm };
