import express from "express";
import { handleGetStaff } from "../../controllers/staffController.js";

const router = express.Router();

router.get("/:id", handleGetStaff);

export default router;
