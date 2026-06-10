import {
  listForTarget,
  createForTarget,
  updateOwn,
  deleteOwn,
} from "../services/commentServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";

const TARGET_TYPES = ["EventType", "User", "Membership"];

const commentBodySchema = {
  body: { type: "string", required: true },
};

const isValidTargetType = (t) => TARGET_TYPES.includes(t);

const validateBodyShape = (raw) => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 1000) return null;
  return trimmed;
};

const handleListComments = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!isValidTargetType(targetType) || !isValidObjectId(targetId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    const result = await listForTarget({
      targetType,
      targetId,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleCreateComment = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!isValidTargetType(targetType) || !isValidObjectId(targetId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    const validated = validateSchema(commentBodySchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }
    const body = validateBodyShape(validated.body);
    if (!body) {
      return httpResponse(res, generalStatus.BAD_REQUEST, {
        errors: { body: { error: "body length 1-1000" } },
      });
    }
    const created = await createForTarget({
      authorId: req.user.id,
      targetType,
      targetId,
      body,
    });
    return httpResponse(res, generalStatus.CREATED, created);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUpdateComment = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    const validated = validateSchema(commentBodySchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }
    const body = validateBodyShape(validated.body);
    if (!body) {
      return httpResponse(res, generalStatus.BAD_REQUEST, {
        errors: { body: { error: "body length 1-1000" } },
      });
    }
    const updated = await updateOwn({
      commentId: req.params.id,
      authorId: req.user.id,
      body,
    });
    return httpResponse(res, generalStatus.SUCCESS, updated);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeleteComment = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    await deleteOwn({ commentId: req.params.id, authorId: req.user.id });
    return httpResponse(res, generalStatus.SUCCESS);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export {
  handleListComments,
  handleCreateComment,
  handleUpdateComment,
  handleDeleteComment,
};
