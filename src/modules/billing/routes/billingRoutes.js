import express from "express";
import { handleWebhook, getPlan, getSubscription, getPayments, getOrders, cancelSubscription, getCatalog } from "../controller/billingController.js";
import { authMiddleware } from "../../auth/index.js";

const router = express.Router();

router.post("/webhook", handleWebhook);
router.get("/catalog", getCatalog);

router.get("/plan", authMiddleware, getPlan);
router.get("/subscription", authMiddleware, getSubscription);
router.get("/payments", authMiddleware, getPayments);
router.get("/orders", authMiddleware, getOrders);
router.post("/cancel", authMiddleware, cancelSubscription);

export default router;
