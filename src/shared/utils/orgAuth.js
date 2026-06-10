import { getMembershipByUserAndOrg } from "../../repository/membershipRepository.js";
import { HttpError } from "./http/httpError.js";
import { generalStatus } from "./http/httpStatus.js";

const ADMIN_ROLES = ["owner", "admin"];

const requireOrgRole = async (userId, orgId, allowedRoles) => {
  if (!userId || !orgId) {
    throw new HttpError({ ...generalStatus.FORBIDDEN, message: "org membership required" });
  }
  const membership = await getMembershipByUserAndOrg(userId, orgId);
  if (!membership || membership.status !== "active") {
    throw new HttpError({ ...generalStatus.FORBIDDEN, message: "not a member of this org" });
  }
  if (!allowedRoles.includes(membership.role)) {
    throw new HttpError({ ...generalStatus.FORBIDDEN, message: "insufficient role" });
  }
  return membership;
};

const requireOrgAdmin = (userId, orgId) => requireOrgRole(userId, orgId, ADMIN_ROLES);

export { requireOrgAdmin, requireOrgRole };
