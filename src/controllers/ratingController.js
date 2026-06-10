import {
  setRating,
  removeMyRating,
  getRatingSummary,
} from "../services/ratingServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";

const TARGET_TYPES = ["EventType", "User", "Membership"];

const setRatingSchema = {
  value: { type: "number", required: true },
};

const isValidTargetType = (t) => TARGET_TYPES.includes(t);

const handleGetRatingSummary = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!isValidTargetType(targetType) || !isValidObjectId(targetId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    const viewerId = req.user ? req.user.id : null;
    const summary = await getRatingSummary({ targetType, targetId, viewerId });
    return httpResponse(res, generalStatus.SUCCESS, summary);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleSetRating = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!isValidTargetType(targetType) || !isValidObjectId(targetId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    const validated = validateSchema(setRatingSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const value = Number(validated.value);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return httpResponse(res, generalStatus.BAD_REQUEST, {
        errors: { value: { error: "value must be integer 1-5" } },
      });
    }

    await setRating({
      authorId: req.user.id,
      targetType,
      targetId,
      value,
    });

    const summary = await getRatingSummary({
      targetType,
      targetId,
      viewerId: req.user.id,
    });
    return httpResponse(res, generalStatus.SUCCESS, summary);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeleteRating = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    if (!isValidTargetType(targetType) || !isValidObjectId(targetId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    await removeMyRating({
      authorId: req.user.id,
      targetType,
      targetId,
    });

    const summary = await getRatingSummary({
      targetType,
      targetId,
      viewerId: req.user.id,
    });
    return httpResponse(res, generalStatus.SUCCESS, summary);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetRatingSummary, handleSetRating, handleDeleteRating };
