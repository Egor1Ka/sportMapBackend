import { getSlotsForDate } from "../services/slotServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const handleGetSlots = async (req, res) => {
  try {
    const { staffId, eventTypeId, date, locationId, slotMode } = req.query;

    if (!staffId || !isValidObjectId(staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!eventTypeId || !isValidObjectId(eventTypeId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!date) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const result = await getSlotsForDate({ staffId, eventTypeId, date, locationId, slotMode });

    if (result.error === "eventType_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    if (result.error === "template_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }

    return httpResponse(res, generalStatus.SUCCESS, result.slots);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetSlots };
