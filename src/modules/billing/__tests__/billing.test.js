import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, stopServer, clearCollections, getBaseUrl } from "./setup.js";
import {
  createTestUser,
  createActiveSubscription,
  buildCheckoutPayload,
  buildSubscriptionEventPayload,
  buildRenewalPayload,
  sendWebhook,
  TEST_PRODUCT_ORG_CREATOR,
  TEST_SUBSCRIPTION_ID,
  TEST_EMAIL,
} from "./helpers.js";
import Subscription from "../model/Subscription.js";
import Payment from "../model/Payment.js";

describe("Billing webhooks", () => {
  before(async () => {
    await startServer();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  after(async () => {
    await stopServer();
  });

  // ── Group 1: New Subscription (checkout.completed) ───────────────────────

  describe("checkout.completed", () => {
    it("1.1 creates subscription with active status", async () => {
      await createTestUser(TEST_EMAIL);
      const payload = buildCheckoutPayload();

      const res = await sendWebhook(getBaseUrl(), "checkout.completed", payload);
      assert.equal(res.statusCode, 200);

      const sub = await Subscription.findOne({ providerSubscriptionId: TEST_SUBSCRIPTION_ID });
      assert.ok(sub, "Subscription should exist in DB");
      assert.equal(sub.status, "active");
      assert.equal(sub.planKey, "org_creator");
      assert.equal(sub.productId, TEST_PRODUCT_ORG_CREATOR);
    });

    it("1.2 creates payment record", async () => {
      await createTestUser(TEST_EMAIL);
      const payload = buildCheckoutPayload();

      await sendWebhook(getBaseUrl(), "checkout.completed", payload);

      const payment = await Payment.findOne({ eventType: "checkout.completed" });
      assert.ok(payment, "Payment should exist in DB");
      assert.equal(payment.type, "subscription");
      assert.equal(payment.amount, 499);
      assert.equal(payment.currency, "USD");
    });

    it("1.3 skips subscription when user not found", async () => {
      const payload = buildCheckoutPayload({
        customer: { id: "cus_unknown", email: "unknown@example.com" },
      });

      const res = await sendWebhook(getBaseUrl(), "checkout.completed", payload);
      assert.equal(res.statusCode, 200);

      const subCount = await Subscription.countDocuments();
      assert.equal(subCount, 0, "No subscription should be created when user not found");
    });

    it("1.4 duplicate checkout does not create duplicates", async () => {
      await createTestUser(TEST_EMAIL);
      const payload = buildCheckoutPayload();

      await sendWebhook(getBaseUrl(), "checkout.completed", payload);
      await sendWebhook(getBaseUrl(), "checkout.completed", payload);

      const subCount = await Subscription.countDocuments();
      assert.equal(subCount, 1, "Should have exactly 1 subscription");

      const paymentCount = await Payment.countDocuments();
      assert.equal(paymentCount, 1, "Should have exactly 1 payment");
    });
  });

  // ── Group 2: Renewal (subscription.paid) ─────────────────────────────────

  describe("subscription.paid", () => {
    it("2.1 updates existing subscription without duplication", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);
      const payload = buildRenewalPayload();

      const res = await sendWebhook(getBaseUrl(), "subscription.paid", payload);
      assert.equal(res.statusCode, 200);

      const subCount = await Subscription.countDocuments();
      assert.equal(subCount, 1, "Should still have exactly 1 subscription");

      const sub = await Subscription.findOne({ providerSubscriptionId: TEST_SUBSCRIPTION_ID });
      assert.equal(sub.status, "active");
    });

    it("2.2 updates billing period dates", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);

      const newPeriodStart = "2026-04-01T00:00:00Z";
      const newPeriodEnd = "2026-05-01T00:00:00Z";
      const payload = buildRenewalPayload({
        current_period_start_date: newPeriodStart,
        current_period_end_date: newPeriodEnd,
      });

      await sendWebhook(getBaseUrl(), "subscription.paid", payload);

      const sub = await Subscription.findOne({ providerSubscriptionId: TEST_SUBSCRIPTION_ID });
      assert.equal(sub.currentPeriodStart.toISOString(), new Date(newPeriodStart).toISOString());
      assert.equal(sub.currentPeriodEnd.toISOString(), new Date(newPeriodEnd).toISOString());
    });

    it("2.3 creates renewal payment record", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);
      const payload = buildRenewalPayload();

      await sendWebhook(getBaseUrl(), "subscription.paid", payload);

      const payment = await Payment.findOne({ eventType: "subscription.paid" });
      assert.ok(payment, "Renewal payment should exist in DB");
      assert.equal(payment.amount, 499);
      assert.equal(payment.currency, "USD");
    });
  });

  // ── Group 3: Cancellation (subscription.canceled) ────────────────────────

  describe("subscription.canceled", () => {
    it("3.1 sets status to canceled", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);

      const payload = buildSubscriptionEventPayload({
        canceled_at: "2026-04-01T00:00:00Z",
        status: "canceled",
      });

      const res = await sendWebhook(getBaseUrl(), "subscription.canceled", payload);
      assert.equal(res.statusCode, 200);

      const sub = await Subscription.findOne({ providerSubscriptionId: TEST_SUBSCRIPTION_ID });
      assert.equal(sub.status, "canceled");
    });

    it("3.2 scheduled_cancel then canceled flow", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);

      const scheduledPayload = buildSubscriptionEventPayload({
        canceled_at: "2026-04-01T00:00:00Z",
        status: "scheduled_cancel",
      });
      await sendWebhook(getBaseUrl(), "subscription.scheduled_cancel", scheduledPayload);

      const subAfterScheduled = await Subscription.findOne({
        providerSubscriptionId: TEST_SUBSCRIPTION_ID,
      });
      assert.equal(subAfterScheduled.status, "scheduled_cancel");

      const canceledPayload = buildSubscriptionEventPayload({
        canceled_at: "2026-04-01T00:00:00Z",
        status: "canceled",
      });
      await sendWebhook(getBaseUrl(), "subscription.canceled", canceledPayload);

      const subAfterCanceled = await Subscription.findOne({
        providerSubscriptionId: TEST_SUBSCRIPTION_ID,
      });
      assert.equal(subAfterCanceled.status, "canceled");
    });

    it("3.3 canceled subscription not returned as active", async () => {
      const user = await createTestUser(TEST_EMAIL);
      await createActiveSubscription(user._id);

      const payload = buildSubscriptionEventPayload({
        canceled_at: "2026-04-01T00:00:00Z",
        status: "canceled",
      });
      await sendWebhook(getBaseUrl(), "subscription.canceled", payload);

      const { getActiveSubscriptionByUserId } = await import(
        "../repository/subscriptionRepository.js"
      );
      const activeSub = await getActiveSubscriptionByUserId(user._id);
      assert.equal(activeSub, null, "Canceled subscription should not be returned as active");
    });
  });
});
