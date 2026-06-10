import * as planRepository from '../repository/plan.js';
import * as userSubscriptionRepository from '../repository/userSubscription.js';
import * as usageCounterRepository from '../repository/usageCounter.js';
import { DomainError } from '../utils/http/httpError.js';
import { httpStatus } from '../utils/http/httpStatus.js';

const FREE_COUNTER_TYPE = 'free_sessions_monthly';
const FREE_MONTHLY_LIMIT = 5;
const SUBSCRIPTION_STATUS_ACTIVE = 'active';
const SUBSCRIPTION_STATUS_QUEUED = 'queued';
const SUBSCRIPTION_STATUS_EXPIRED = 'expired';
const SUBSCRIPTION_STATUS_EXHAUSTED = 'exhausted';
const DEFAULT_PURCHASE_SOURCE = 'manual';
const PURCHASE_SOURCES = ['manual', 'stripe', 'promo', 'creem'];
const DUPLICATE_KEY_ERROR = 11000;

const addDays = (date, days) => {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const toPeriodKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const toPeriodStart = (date) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
};

const toPeriodEnd = (date) => {
  const periodStart = toPeriodStart(date);
  return new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1, 0, 0, 0, 0));
};

const toSubscriptionFilterActive = (userId, now) => ({
  userId,
  status: SUBSCRIPTION_STATUS_ACTIVE,
  startsAt: { $lte: now },
  expiresAt: { $gt: now },
});

const toActiveConsumableFilter = (userId, now) => ({
  ...toSubscriptionFilterActive(userId, now),
  remainingCredits: { $gt: 0 },
});

const toSubscriptionDto = (doc) => {
  if (!doc) {
    return null;
  }
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    planCode: doc.planCode,
    planVersion: doc.planVersion,
    planSnapshot: doc.planSnapshot,
    status: doc.status,
    totalCredits: doc.totalCredits,
    remainingCredits: doc.remainingCredits,
    consumedCredits: doc.consumedCredits,
    queuedAt: doc.queuedAt ?? null,
    startsAt: doc.startsAt ?? null,
    expiresAt: doc.expiresAt ?? null,
    activatedAt: doc.activatedAt ?? null,
    closedAt: doc.closedAt ?? null,
    source: doc.source,
    metadata: doc.metadata ?? {},
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
};

const closeExpiredActiveSubscriptions = (userId, now) => {
  const filter = {
    userId,
    status: SUBSCRIPTION_STATUS_ACTIVE,
    expiresAt: { $lte: now },
  };
  const update = {
    $set: {
      status: SUBSCRIPTION_STATUS_EXPIRED,
      closedAt: now,
    },
  };
  return userSubscriptionRepository.updateMany(filter, update);
};

const closeExhaustedActiveSubscriptions = (userId, now) => {
  const filter = {
    userId,
    status: SUBSCRIPTION_STATUS_ACTIVE,
    remainingCredits: { $lte: 0 },
  };
  const update = {
    $set: {
      status: SUBSCRIPTION_STATUS_EXHAUSTED,
      closedAt: now,
    },
  };
  return userSubscriptionRepository.updateMany(filter, update);
};

const findActiveSubscription = (userId, now) => {
  const filter = toSubscriptionFilterActive(userId, now);
  const options = { sort: { startsAt: 1 } };
  return userSubscriptionRepository.findOne(filter, options);
};

const activateNextQueuedSubscription = async (userId, now) => {
  const queuedFilter = {
    userId,
    status: SUBSCRIPTION_STATUS_QUEUED,
  };
  const queuedOptions = { sort: { queuedAt: 1, createdAt: 1 } };
  const queued = await userSubscriptionRepository.findOne(queuedFilter, queuedOptions);
  if (!queued) {
    return null;
  }
  const durationDays = queued.planSnapshot.billing.durationDays;
  const startsAt = new Date(now.getTime());
  const expiresAt = addDays(startsAt, durationDays);
  const activateFilter = {
    _id: queued._id,
    status: SUBSCRIPTION_STATUS_QUEUED,
  };
  const activateUpdate = {
    $set: {
      status: SUBSCRIPTION_STATUS_ACTIVE,
      startsAt,
      expiresAt,
      activatedAt: startsAt,
    },
  };
  const activateOptions = { new: true };
  return userSubscriptionRepository.findOneAndUpdate(activateFilter, activateUpdate, activateOptions);
};

const rotateQueuedIfNeeded = async (userId, now) => {
  await closeExpiredActiveSubscriptions(userId, now);
  await closeExhaustedActiveSubscriptions(userId, now);
  const active = await findActiveSubscription(userId, now);
  if (active) {
    return active;
  }
  return activateNextQueuedSubscription(userId, now);
};

const consumeFromActiveSubscription = (userId, now) => {
  const filter = toActiveConsumableFilter(userId, now);
  const update = {
    $inc: {
      remainingCredits: -1,
      consumedCredits: 1,
    },
  };
  const options = {
    new: true,
    sort: { startsAt: 1 },
  };
  return userSubscriptionRepository.findOneAndUpdate(filter, update, options);
};

const buildFreeCounterDefaults = (userId, now) => {
  const periodStart = toPeriodStart(now);
  const periodEnd = toPeriodEnd(now);
  return {
    userId,
    counterType: FREE_COUNTER_TYPE,
    periodKey: toPeriodKey(now),
    limitSnapshot: FREE_MONTHLY_LIMIT,
    periodStart,
    periodEnd,
  };
};

const consumeFreeCounterOnce = async (userId, now) => {
  const counterForInsert = buildFreeCounterDefaults(userId, now);
  const filter = {
    userId: counterForInsert.userId,
    counterType: counterForInsert.counterType,
    periodKey: counterForInsert.periodKey,
    $or: [
      { used: { $lt: FREE_MONTHLY_LIMIT } },
      { used: { $exists: false } },
    ],
  };
  const update = {
    $setOnInsert: counterForInsert,
    $inc: { used: 1 },
  };
  const options = { upsert: true, new: true };
  return usageCounterRepository.findOneAndUpdate(filter, update, options);
};

const findFreeCounterForCurrentPeriod = (userId, now) => {
  const filter = {
    userId,
    counterType: FREE_COUNTER_TYPE,
    periodKey: toPeriodKey(now),
  };
  return usageCounterRepository.findOne(filter);
};

const consumeFreeCounter = async (userId, now, retries = 1) => {
  try {
    const consumed = await consumeFreeCounterOnce(userId, now);
    if (consumed) {
      return consumed;
    }
    return null;
  } catch (error) {
    if (error?.code !== DUPLICATE_KEY_ERROR) {
      throw error;
    }
    if (retries <= 0) {
      throw error;
    }
    return consumeFreeCounter(userId, now, retries - 1);
  }
};

const buildLimitDetails = async (userId, now) => {
  await rotateQueuedIfNeeded(userId, now);
  const [activeSubscription, freeCounter, nextQueued] = await Promise.all([
    findActiveSubscription(userId, now),
    findFreeCounterForCurrentPeriod(userId, now),
    userSubscriptionRepository.findOne(
      { userId, status: SUBSCRIPTION_STATUS_QUEUED },
      { sort: { queuedAt: 1, createdAt: 1 } }
    ),
  ]);
  const periodKey = toPeriodKey(now);
  const used = freeCounter?.used ?? 0;
  const limit = freeCounter?.limitSnapshot ?? FREE_MONTHLY_LIMIT;
  const details = {
    free: {
      used,
      limit,
      periodKey,
    },
    subscription: {
      hasActive: !!activeSubscription,
      remainingCredits: activeSubscription?.remainingCredits ?? 0,
      expiresAt: activeSubscription?.expiresAt ?? null,
    },
  };
  if (nextQueued) {
    const nextStart = nextQueued.startsAt ?? activeSubscription?.expiresAt ?? null;
    details.nextQueuedPlanStart = nextStart;
  }
  return details;
};

const toAccessSource = (activeSubscription, freeCounter) => {
  if (activeSubscription?.remainingCredits > 0) {
    return 'subscription';
  }
  const freeUsed = freeCounter?.used ?? 0;
  const freeLimit = freeCounter?.limitSnapshot ?? FREE_MONTHLY_LIMIT;
  if (freeUsed < freeLimit) {
    return 'free';
  }
  return 'none';
};

export async function consumeSessionAccess(userId) {
  const now = new Date();
  await rotateQueuedIfNeeded(userId, now);
  const activeFirstPass = await consumeFromActiveSubscription(userId, now);
  if (activeFirstPass) {
    await rotateQueuedIfNeeded(userId, now);
    return {
      source: 'subscription',
      entitlements: activeFirstPass.planSnapshot.entitlements ?? {},
    };
  }
  await rotateQueuedIfNeeded(userId, now);
  const activeSecondPass = await consumeFromActiveSubscription(userId, now);
  if (activeSecondPass) {
    await rotateQueuedIfNeeded(userId, now);
    return {
      source: 'subscription',
      entitlements: activeSecondPass.planSnapshot.entitlements ?? {},
    };
  }
  const freeCounter = await consumeFreeCounter(userId, now);
  if (freeCounter) {
    return { source: 'free', entitlements: {} };
  }
  const details = await buildLimitDetails(userId, now);
  throw new DomainError('Payment Required', httpStatus.PAYMENT_REQUIRED, {
    code: 'LIMIT_REACHED',
    details,
  });
}

export async function getBillingStatus(userId) {
  const now = new Date();
  await rotateQueuedIfNeeded(userId, now);
  const [active, queued, freeCounter] = await Promise.all([
    findActiveSubscription(userId, now),
    userSubscriptionRepository.find({ userId, status: SUBSCRIPTION_STATUS_QUEUED }, { sort: { queuedAt: 1 } }),
    findFreeCounterForCurrentPeriod(userId, now),
  ]);
  const accessSource = toAccessSource(active, freeCounter);
  const periodKey = toPeriodKey(now);
  const freeUsed = freeCounter?.used ?? 0;
  const freeLimit = freeCounter?.limitSnapshot ?? FREE_MONTHLY_LIMIT;
  const freeRemaining = Math.max(freeLimit - freeUsed, 0);
  return {
    accessSource,
    free: {
      periodKey,
      used: freeUsed,
      limit: freeLimit,
      remaining: freeRemaining,
    },
    subscription: active
      ? {
          hasActive: true,
          remainingCredits: active.remainingCredits,
          expiresAt: active.expiresAt,
          entitlements: active.planSnapshot.entitlements ?? {},
        }
      : {
          hasActive: false,
          remainingCredits: 0,
          expiresAt: null,
          entitlements: {},
        },
    activeSubscription: toSubscriptionDto(active),
    queuedSubscriptions: queued.map(toSubscriptionDto),
    entitlements: active?.planSnapshot.entitlements ?? {},
  };
}

const createActiveSubscriptionPayload = (userId, plan, source, metadata, now) => {
  const startsAt = new Date(now.getTime());
  const expiresAt = addDays(startsAt, plan.billing.durationDays);
  const sessionCredits = plan.billing.sessionCredits;
  return {
    userId,
    planCode: plan.code,
    planVersion: plan.version,
    planSnapshot: {
      billing: plan.billing,
      entitlements: plan.entitlements ?? {},
      name: plan.name,
    },
    status: SUBSCRIPTION_STATUS_ACTIVE,
    totalCredits: sessionCredits,
    remainingCredits: sessionCredits,
    consumedCredits: 0,
    startsAt,
    expiresAt,
    activatedAt: startsAt,
    source,
    metadata,
  };
};

const createQueuedSubscriptionPayload = (userId, plan, source, metadata, now) => {
  const sessionCredits = plan.billing.sessionCredits;
  return {
    userId,
    planCode: plan.code,
    planVersion: plan.version,
    planSnapshot: {
      billing: plan.billing,
      entitlements: plan.entitlements ?? {},
      name: plan.name,
    },
    status: SUBSCRIPTION_STATUS_QUEUED,
    totalCredits: sessionCredits,
    remainingCredits: sessionCredits,
    consumedCredits: 0,
    queuedAt: new Date(now.getTime()),
    source,
    metadata,
  };
};

export async function purchaseSubscription(userId, payload = {}) {
  const planCode = payload.planCode;
  const source = payload.source ?? DEFAULT_PURCHASE_SOURCE;
  const metadata = payload.metadata ?? {};
  if (!planCode) {
    throw new DomainError('planCode is required', httpStatus.BAD_REQUEST);
  }
  if (!PURCHASE_SOURCES.includes(source)) {
    throw new DomainError('Invalid source', httpStatus.BAD_REQUEST);
  }
  const plan = await planRepository.findLatestActiveByCode(planCode);
  if (!plan) {
    throw new DomainError('Plan not found', httpStatus.NOT_FOUND);
  }
  const now = new Date();
  await rotateQueuedIfNeeded(userId, now);
  const active = await findActiveSubscription(userId, now);
  const data = active
    ? createQueuedSubscriptionPayload(userId, plan, source, metadata, now)
    : createActiveSubscriptionPayload(userId, plan, source, metadata, now);
  const created = await userSubscriptionRepository.create(data);
  return toSubscriptionDto(created.toObject());
}
