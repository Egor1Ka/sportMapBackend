import express from "express";
import { handleGoogleLogin, handleGoogleCallback, handleRefreshToken, handleLogout } from "../controller/authController.js";

const router = express.Router();

router.get("/google", handleGoogleLogin);
router.get("/google/callback", handleGoogleCallback);
router.post("/refresh", handleRefreshToken);
router.post("/logout", handleLogout);

export default router;
