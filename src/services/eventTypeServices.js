import {
  getEventTypeById as repoGetById,
  getEventTypesForStaff as repoGetForStaff,
  getEventTypesByOrg as repoGetByOrg,
} from "../repository/eventTypeRepository.js";
import { getMembershipByUserAndOrg } from "../repository/membershipRepository.js";
import { findByEventTypeAndPosition } from "../repository/positionPricingRepository.js";

const getEventTypeById = async (id) => {
  return repoGetById(id);
};

const applyPositionPricing = (positionId) => async (eventType) => {
  if (!positionId || !eventType.orgId) return eventType;
  const override = await findByEventTypeAndPosition(eventType.id, positionId);
  if (!override) return eventType;
  return {
    ...eventType,
    price: {
      amount: override.price.amount,
      currency: eventType.price ? eventType.price.currency : "UAH",
    },
  };
};

const getEventTypesForStaff = async (staffId, explicitOrgId) => {
  if (!explicitOrgId) {
    return repoGetForStaff(staffId, null, null);
  }
  const membership = await getMembershipByUserAndOrg(staffId, explicitOrgId);
  const orgId = membership ? membership.orgId : null;
  const positionId = membership ? membership.positionId : null;
  const eventTypes = await repoGetForStaff(staffId, orgId, positionId);
  if (!positionId) return eventTypes;
  return Promise.all(eventTypes.map(applyPositionPricing(positionId)));
};

const getEventTypesByOrg = async (orgId) => {
  return repoGetByOrg(orgId);
};

export { getEventTypeById, getEventTypesForStaff, getEventTypesByOrg };
