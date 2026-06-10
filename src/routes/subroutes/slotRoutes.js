import express from "express";
import { handleGetSlots } from "../../controllers/slotController.js";

const router = express.Router();

router.get("/", handleGetSlots);

export default router;
