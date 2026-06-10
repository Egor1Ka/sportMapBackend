import { getStaffProfile } from "../services/staffServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const handleGetStaff = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const { orgId } = req.query;
    const staff = await getStaffProfile(req.params.id, orgId || undefined);
    if (!staff) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, staff);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetStaff };
