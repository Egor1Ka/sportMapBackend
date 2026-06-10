// ── Task Constants ──────────────────────────────────────────────────────────
// Define config, statuses, and enums for your business entity here.
// Copy this file and rename for your own entity (e.g., project.js, order.js).

const TASK_STATUS = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  DONE: "done",
};

const TASK_STATUSES = Object.values(TASK_STATUS);

export { TASK_STATUS, TASK_STATUSES };
