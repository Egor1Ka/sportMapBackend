import Membership from "../../../models/Membership.js";
import Organization from "../../../models/Organization.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const getOwnerOrgIds = async (userId) => {
  const memberships = await Membership.find({
    userId,
    role: "owner",
    status: "active",
  }).select("orgId").lean();

  const toOrgId = (m) => m.orgId;
  return memberships.map(toOrgId);
};

const setOrgsActive = async (userId, active) => {
  const orgIds = await getOwnerOrgIds(userId);
  if (orgIds.length === 0) return;
  await Organization.updateMany({ _id: { $in: orgIds } }, { active });
};

// ── Product lifecycle hooks ──────────────────────────────────────────────────

const PRODUCT_HOOKS = {
  org_creator: {
    onActivate: async (user) => {
      await setOrgsActive(user._id || user.id, true);
    },
    onDeactivate: async (user) => {
      await setOrgsActive(user._id || user.id, false);
    },
    onRenew: async () => {},
  },
};

const getHooksForPlan = (planKey) => PRODUCT_HOOKS[planKey];

export { PRODUCT_HOOKS, getHooksForPlan };
