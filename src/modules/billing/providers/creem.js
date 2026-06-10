import crypto from "crypto";
import { Creem } from "creem";
import { EVENT_NORMALIZERS } from "./normalizers.js";

const { CREEM_API_KEY, CREEM_WEBHOOK_SECRET } = process.env;

const creemClient = CREEM_API_KEY ? new Creem({ apiKey: CREEM_API_KEY }) : null;

// ── Provider metadata ────────────────────────────────────────────────────────

const signatureHeader = "creem-signature";

// ── Webhook signature verification ───────────────────────────────────────────

const generateSignature = (payload, secret) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

const verifySignature = (rawBody, signature) => {
  const expected = generateSignature(rawBody, CREEM_WEBHOOK_SECRET);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

// ── Parse full webhook event ────────────────────────────────────────────────
// Creem envelope: { eventType: "...", object: { ... } }

const parseWebhookEvent = (rawBody, signature) => {
  if (!verifySignature(rawBody, signature)) return null;

  const event = JSON.parse(rawBody);
  const eventType = event.eventType || event.event_type;
  const eventData = event.object || event.data || event;

  const normalize = EVENT_NORMALIZERS[eventType];

  if (!normalize) {
    return { eventType, data: eventData };
  }

  return {
    eventType,
    data: normalize(eventData),
  };
};

// ── Cancel subscription ─────────────────────────────────────────────────────

const cancelSubscription = (subscriptionId, options) => {
  if (!creemClient) throw new Error("Payment provider not configured");
  return creemClient.subscriptions.cancel(subscriptionId, options);
};

export default {
  signatureHeader,
  parseWebhookEvent,
  cancelSubscription,
};
