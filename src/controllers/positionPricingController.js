import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";
import { getPricing, syncPricing } from "../services/positionPricingServices.js";

const handleGetPricing = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    const data = await getPricing(req.params.id);
    return httpResponse(res, generalStatus.SUCCESS, data);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleSyncPricing = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const { overrides } = req.body;
    if (!Array.isArray(overrides)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const isValidOverride = (o) => o && isValidObjectId(o.positionId);
    if (!overrides.every(isValidOverride)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const result = await syncPricing(req.params.id, overrides);
    if (result === null) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetPricing, handleSyncPricing };
