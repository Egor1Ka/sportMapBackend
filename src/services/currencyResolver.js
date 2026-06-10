import { getRawOrgById } from "../repository/organizationRepository.js";
import { findCurrentTemplate } from "../repository/scheduleTemplateRepository.js";

const DEFAULT_CURRENCY = "UAH";

const resolveCurrency = async ({ orgId, userId } = {}) => {
  if (orgId) {
    const org = await getRawOrgById(orgId);
    return org?.currency ?? DEFAULT_CURRENCY;
  }
  if (userId) {
    const template = await findCurrentTemplate(userId, null, null);
    return template?.currency ?? DEFAULT_CURRENCY;
  }
  return DEFAULT_CURRENCY;
};

export { resolveCurrency, DEFAULT_CURRENCY };
