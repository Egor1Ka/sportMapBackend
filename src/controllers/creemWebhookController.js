import crypto from 'crypto';
import { httpStatus } from '../utils/http/httpStatus.js';
import { getProduct } from '../products/registry.js';

const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET;
const CREEM_SIGNATURE_HEADER = 'creem-signature';

function verifySignature(rawBody, signature, secret) {
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
}

const setEntry = (acc, item) => ({ ...acc, [item.name]: item.value });

function customFieldsToRecord(fields) {
  return fields.reduce(setEntry, {});
}

function getMetadataObject(obj) {
  if (obj.metadata && typeof obj.metadata === 'object') {
    return obj.metadata;
  }
  if (Array.isArray(obj.custom_fields)) {
    return customFieldsToRecord(obj.custom_fields);
  }
  return null;
}

function getSubscriptionId(subscription) {
  if (typeof subscription === 'string') return subscription;
  if (subscription && typeof subscription === 'object' && subscription.id != null) return subscription.id;
  return null;
}

function getOrderId(order) {
  if (typeof order === 'string') return order;
  if (order && typeof order === 'object' && order.id != null) return order.id;
  return null;
}

function getCreemIdsFromEventObject(eventObject) {
  const sub = eventObject.subscription;
  const order = eventObject.order;
  return {
    creemSubscriptionId: sub != null ? getSubscriptionId(sub) : null,
    creemOrderId: order != null ? getOrderId(order) : null,
  };
}

/** Backward-compatible metadata extraction: supports old { userId, planCode } and new { userId, productCode, planCode } */
function toMeta(metaObj) {
  return {
    userId: String(metaObj.userId),
    productCode: String(metaObj.productCode ?? 'subscription'),
    planCode: String(metaObj.planCode),
  };
}

function respondOk(res) {
  res.status(httpStatus.OK).json({ received: true });
}

function respondUnauthorized(res) {
  res.status(httpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
}

function respondBadRequest(res, error) {
  res.status(httpStatus.BAD_REQUEST).json({ error });
}

function respondServerError(res, error) {
  res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error });
}

const parseJsonSafe = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

/**
 * POST /webhooks/creem — no auth, raw body for signature verification.
 * req.body is a Buffer (use express.raw for this route).
 */
export async function postCreemWebhook(req, res) {
  const rawBody = req.body;
  const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
  const signature = req.headers[CREEM_SIGNATURE_HEADER];

  if (!CREEM_WEBHOOK_SECRET) {
    console.error('Creem webhook: CREEM_WEBHOOK_SECRET not set');
    respondServerError(res, 'Webhook not configured');
    return;
  }

  if (!signature) {
    respondUnauthorized(res);
    return;
  }

  try {
    if (!verifySignature(rawString, signature, CREEM_WEBHOOK_SECRET)) {
      respondUnauthorized(res);
      return;
    }
  } catch {
    respondUnauthorized(res);
    return;
  }

  const payload = parseJsonSafe(rawString);
  if (!payload) {
    respondBadRequest(res, 'Invalid JSON');
    return;
  }

  console.log('[Creem webhook] payload:', JSON.stringify(payload, null, 2));

  const eventType = payload.eventType;
  console.log('[Creem webhook] eventType:', eventType);

  const eventObject = payload.object;
  if (!eventObject || typeof eventObject !== 'object') {
    console.warn('Creem webhook: missing payload.object', { eventType });
    respondOk(res);
    return;
  }

  const metaObj = getMetadataObject(eventObject);
  if (!metaObj || metaObj.userId == null || metaObj.planCode == null) {
    console.warn('Creem webhook: missing metadata userId/planCode', { eventType });
    respondOk(res);
    return;
  }

  const meta = toMeta(metaObj);
  const creemIds = getCreemIdsFromEventObject(eventObject);
  console.log('[Creem webhook] meta:', meta, 'creemIds:', creemIds);

  const product = getProduct(meta.productCode);
  if (!product) {
    console.warn('Creem webhook: unknown productCode', { productCode: meta.productCode, eventType });
    respondOk(res);
    return;
  }

  const handler = product.handlers[eventType];
  if (!handler) {
    respondOk(res);
    return;
  }

  try {
    await handler(meta.userId, meta, creemIds);
  } catch (err) {
    console.error('Creem webhook: handler threw unexpectedly', err && err.message ? err.message : err);
    respondOk(res);
    return;
  }

  respondOk(res);
}
