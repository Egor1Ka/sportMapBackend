// ── Task Model ──────────────────────────────────────────────────────────────
// Mongoose schema for your business entity.
// Copy this file and adapt the fields for your own entity.

import mongoose from "mongoose";
import { TASK_STATUSES, TASK_STATUS } from "../constants/task.js";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: TASK_STATUSES, default: TASK_STATUS.TODO },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

taskSchema.index({ userId: 1, status: 1 });

const Task = mongoose.model("Task", taskSchema);

export default Task;
