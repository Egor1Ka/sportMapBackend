import express from "express";
import { handleSearchUsers } from "../../controllers/userSearchController.js";
import { authMiddleware } from "../../modules/auth/index.js";

const router = express.Router();

router.get("/search", authMiddleware, handleSearchUsers);

export default router;
