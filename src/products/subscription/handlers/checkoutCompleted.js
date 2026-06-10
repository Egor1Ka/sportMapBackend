import * as billingService from '../../../services/billingService.js';
import * as userSubscriptionRepository from '../../../repository/userSubscription.js';

const logHandlerError = (err) => {
  console.error('Creem subscription checkoutCompleted failed', err && err.message ? err.message : err);
  if (err && err.code) console.error('error code:', err.code);
  if (err && err.details) console.error('details:', err.details);
};

const findExistingByOrderId = (userId, orderId) =>
  userSubscriptionRepository.findOne({
    userId,
    source: 'creem',
    'metadata.creemOrderId': orderId,
  });

export async function checkoutCompleted(userId, meta, creemIds) {
  const orderId = creemIds.creemOrderId;
  if (orderId) {
    const existing = await findExistingByOrderId(userId, orderId);
    if (existing) return;
  }

  try {
    await billingService.purchaseSubscription(userId, {
      planCode: meta.planCode,
      source: 'creem',
      metadata: creemIds,
    });
  } catch (err) {
    logHandlerError(err);
  }
}
