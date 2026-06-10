import { getUserBillingProfile, planHasFeature } from "../services/planServices.js";
import { httpResponse } from "../../../shared/utils/http/httpResponse.js";
import { generalStatus, billingStatus } from "../../../shared/utils/http/httpStatus.js";
import { PLAN_HIERARCHY } from "../constants/billing.js";

// ── Resolve plan once per request ────────────────────────────────────────────

const ensurePlan = async (req) => {
  if (!req.plan) {
    req.plan = await getUserBillingProfile(req.user.id);
  }
  return req.plan;
};

// ── Middleware factories ─────────────────────────────────────────────────────

const requireFeature = (featureName) => async (req, res, next) => {
  try {
    const plan = await ensurePlan(req);
    const hasAccess = planHasFeature(plan, featureName);

    if (!hasAccess) {
      httpResponse(res, billingStatus.FEATURE_LOCKED);
      return;
    }

    next();
  } catch (error) {
    console.error("requireFeature error:", error);
    httpResponse(res, billingStatus.FEATURE_LOCKED);
  }
};

const requirePlan = (minimumPlanKey) => async (req, res, next) => {
  try {
    const plan = await ensurePlan(req);
    const userLevel = PLAN_HIERARCHY.indexOf(plan.key);
    const requiredLevel = PLAN_HIERARCHY.indexOf(minimumPlanKey);

    if (userLevel < requiredLevel) {
      httpResponse(res, billingStatus.PLAN_REQUIRED);
      return;
    }

    next();
  } catch (error) {
    console.error("requirePlan error:", error);
    httpResponse(res, billingStatus.PLAN_REQUIRED);
  }
};

const attachPlan = async (req, res, next) => {
  try {
    await ensurePlan(req);
    next();
  } catch (error) {
    console.error("attachPlan error:", error);
    httpResponse(res, generalStatus.ERROR);
  }
};

export { requireFeature, requirePlan, attachPlan };
