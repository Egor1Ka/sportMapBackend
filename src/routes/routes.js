import { Router } from "express";
import authRoutes from "./subroutes/authRoutes.js";
import sessionRoutes from "./subroutes/sessionRoutes.js";
import billingRoutes from "./subroutes/billingRoutes.js";
import subscriptionRoutes from "./subroutes/subscriptionRoutes.js";
import sportRoutes from "./subroutes/sportRoutes.js";
import playgroundRoutes from "./subroutes/playgroundRoutes.js";
import commentRoutes from "./subroutes/commentRoutes.js";
import ratingRoutes from "./subroutes/ratingRoutes.js";
import eventRoutes from "./subroutes/eventRoutes.js";
import userRoutes from "./subroutes/userRoutes.js";
import adminPlaygroundEditRequestRoutes from "./subroutes/adminPlaygroundEditRequestRoutes.js";

const prefix = process.env.API_PREFIX ?? "";
const router = Router();

router.use("/auth", authRoutes);
router.use("/sessions", sessionRoutes);
router.use("/billing", billingRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/sports", sportRoutes);
router.use("/playgrounds", playgroundRoutes);
router.use("/comments", commentRoutes);
router.use("/ratings", ratingRoutes);
router.use("/events", eventRoutes);
router.use("/user", userRoutes);
router.use("/admin/playground-edit-requests", adminPlaygroundEditRequestRoutes);

const appRouter = prefix
  ? (() => {
      const main = Router();
      main.use(prefix, router);
      return main;
    })()
  : router;

export default appRouter;
