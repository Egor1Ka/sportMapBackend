import express from "express";
import {
  createUser,
  getUser,
  updateUser,
  deleteUser,
  getProfile,
  connectTelegram,
  disconnectTelegramHandler,
  uploadUserAvatar,
  deleteUserAvatar,
} from "../controller/userController.js";
import { authMiddleware } from "../../auth/index.js";
import { uploadFor, handleUploadError, ASSET_TYPES } from "../../media/index.js";

const router = express.Router();

router.post("/",          authMiddleware, createUser);
router.get("/profile",    authMiddleware, getProfile);
router.post(
  "/avatar",
  authMiddleware,
  uploadFor(ASSET_TYPES.USER_AVATAR).single("file"),
  handleUploadError,
  uploadUserAvatar,
);
router.delete("/avatar",  authMiddleware, deleteUserAvatar);
router.get("/:id",        authMiddleware, getUser);
router.put("/:id",        authMiddleware, updateUser);
router.delete("/:id",     authMiddleware, deleteUser);

router.post("/telegram/connect",     authMiddleware, connectTelegram);
router.delete("/telegram/disconnect", authMiddleware, disconnectTelegramHandler);

export default router;
