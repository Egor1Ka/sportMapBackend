import Membership from "../models/Membership.js";
import { httpResponse } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";

const ADMIN_ROLES = ["owner", "admin"];

const requireOrgAdmin = (getOrgId) => async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    if (!orgId) {
      httpResponse(res, generalStatus.BAD_REQUEST);
      return;
    }

    const membership = await Membership.findOne({
      userId: req.user.id,
      orgId,
      status: "active",
    });

    if (!membership || !ADMIN_ROLES.includes(membership.role)) {
      httpResponse(res, generalStatus.UNAUTHORIZED);
      return;
    }

    req.membership = membership;
    next();
  } catch (error) {
    console.error("requireOrgAdmin error:", error);
    httpResponse(res, generalStatus.ERROR);
  }
};

const requireOrgMember = (getOrgId) => async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    if (!orgId) {
      httpResponse(res, generalStatus.BAD_REQUEST);
      return;
    }

    const membership = await Membership.findOne({
      userId: req.user.id,
      orgId,
      status: "active",
    });

    if (!membership) {
      httpResponse(res, generalStatus.UNAUTHORIZED);
      return;
    }

    req.membership = membership;
    next();
  } catch (error) {
    console.error("requireOrgMember error:", error);
    httpResponse(res, generalStatus.ERROR);
  }
};

export { requireOrgAdmin, requireOrgMember };
