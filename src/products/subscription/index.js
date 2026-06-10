import { checkoutCompleted } from './handlers/checkoutCompleted.js';
import { subscriptionRenewed } from './handlers/subscriptionRenewed.js';
import * as planRepository from '../../repository/plan.js';

const getCreemProductId = async (planCode) => {
  const plan = await planRepository.findLatestActiveByCode(planCode);
  if (!plan) return null;
  return plan.creemProductId ?? null;
};

export const subscriptionProduct = {
  getCreemProductId,
  handlers: {
    'checkout.completed': checkoutCompleted,
    'subscription.completed': subscriptionRenewed,
  },
};
