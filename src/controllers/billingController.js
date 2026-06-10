import { created, ok, httpResponseError } from "../utils/http/httpResponse.js";
import { httpStatus } from "../utils/http/httpStatus.js";
import * as billingService from "../services/billingService.js";
import * as creemService from "../services/creemService.js";

const getUserId = (req) => req.user?.id;
const getFrontendUrl = () =>
  (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "");

const respondUnauthorized = (res) => {
  res.status(httpStatus.UNAUTHORIZED).json({ error: "Unauthorized" });
};

export async function getStatus(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      respondUnauthorized(res);
      return;
    }
    const status = await billingService.getBillingStatus(userId);
    ok(res, status);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function postPurchase(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      respondUnauthorized(res);
      return;
    }
    const payload = req.body ?? {};
    const subscription = await billingService.purchaseSubscription(
      userId,
      payload,
    );
    created(res, subscription);
  } catch (error) {
    httpResponseError(res, error);
  }
}

export async function postCheckout(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      respondUnauthorized(res);
      return;
    }
    const planCode = req.body?.planCode;
    if (!planCode || typeof planCode !== "string") {
      res
        .status(httpStatus.BAD_REQUEST)
        .json({ error: "planCode is required" });
      return;
    }
    const userEmail = req.user && req.user.email ? req.user.email : null;
    const base = getFrontendUrl();
    const successUrl = `${base}/app/profile?subscription=success`;
    const cancelUrl = `${base}/app/profile?subscription=cancel`;

    const session = await creemService.createCheckoutSession({
      userId,
      productCode: 'subscription',
      planCode,
      userEmail,
      successUrl,
      cancelUrl,
    });
    ok(res, session);
  } catch (error) {
    httpResponseError(res, error);
  }
}
