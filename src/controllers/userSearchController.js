import { searchUsersExcludingOrgMembers } from "../services/userSearchServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus, userStatus } from "../shared/utils/http/httpStatus.js";

const handleSearchUsers = async (req, res) => {
  try {
    const { email, orgId } = req.query;

    if (!email || email.length < 3) {
      return httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: { email: { error: "email — минимум 3 символа" } },
      });
    }

    if (!orgId) {
      return httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: { orgId: { error: "orgId обязателен" } },
      });
    }

    const users = await searchUsersExcludingOrgMembers(email, orgId);
    return httpResponse(res, generalStatus.SUCCESS, users);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleSearchUsers };
