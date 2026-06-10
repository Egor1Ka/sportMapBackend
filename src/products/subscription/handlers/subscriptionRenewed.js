import * as billingService from '../../../services/billingService.js';

const logHandlerError = (err) => {
  console.error('Creem subscription subscriptionRenewed failed', err && err.message ? err.message : err);
  if (err && err.code) console.error('error code:', err.code);
  if (err && err.details) console.error('details:', err.details);
};

export async function subscriptionRenewed(userId, meta, creemIds) {
  try {
    await billingService.purchaseSubscription(userId, {
      planCode: meta.planCode,
      source: 'creem',
      metadata: { ...creemIds, renewal: true },
    });
  } catch (err) {
    logHandlerError(err);
  }
}
