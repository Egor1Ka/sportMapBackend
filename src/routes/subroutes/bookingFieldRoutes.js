import express from "express";
import {
  handleGetFields,
  handleCreateField,
  handleUpdateField,
  handleDeleteField,
  handleGetMergedForm,
} from "../../controllers/bookingFieldController.js";
import { authMiddleware } from "../../modules/auth/index.js";

const router = express.Router();

router.get("/", authMiddleware, handleGetFields);
router.post("/", authMiddleware, handleCreateField);
router.patch("/:id", authMiddleware, handleUpdateField);
router.delete("/:id", authMiddleware, handleDeleteField);

export default router;
export { handleGetMergedForm };
