import {
  getPositionsByOrg,
  createPosition,
  updatePosition,
  deletePosition,
} from "../services/positionService.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const createPositionSchema = {
  name: { type: "string", required: true },
  level: { type: "number", required: false, defaultValue: 0 },
  color: { type: "string", required: false },
};

const updatePositionSchema = {
  name: { type: "string", required: false },
  level: { type: "number", required: false },
  color: { type: "string", required: false },
};

const handleGetPositions = async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId || !isValidObjectId(orgId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const positions = await getPositionsByOrg(orgId);
    return httpResponse(res, generalStatus.SUCCESS, positions);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleCreatePosition = async (req, res) => {
  try {
    const validated = validateSchema(createPositionSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const orgId = req.body.orgId;
    if (!orgId || !isValidObjectId(orgId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const position = await createPosition(orgId, validated);
    return httpResponse(res, generalStatus.CREATED, position);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUpdatePosition = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const validated = validateSchema(updatePositionSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const position = await updatePosition(req.params.id, validated);
    return httpResponse(res, generalStatus.SUCCESS, position);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeletePosition = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    await deletePosition(req.params.id);
    return httpResponse(res, generalStatus.SUCCESS);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetPositions, handleCreatePosition, handleUpdatePosition, handleDeletePosition };
