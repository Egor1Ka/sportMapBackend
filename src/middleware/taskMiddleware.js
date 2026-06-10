// ── Task Middleware ──────────────────────────────────────────────────────────
// Custom middleware for your business routes.
// Example: verify the authenticated user owns the task before allowing access.
// Copy this pattern for any entity-level ownership or permission checks.

import { getTaskById } from "../services/taskServices.js";
import { httpResponse } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";

const requireTaskOwner = async (req, res, next) => {
  try {
    const task = await getTaskById(req.params.id);

    if (!task) {
      httpResponse(res, generalStatus.NOT_FOUND);
      return;
    }

    if (task.userId !== req.user.id) {
      httpResponse(res, generalStatus.UNAUTHORIZED);
      return;
    }

    req.task = task;
    next();
  } catch (error) {
    console.error("requireTaskOwner error:", error);
    httpResponse(res, generalStatus.ERROR);
  }
};

export { requireTaskOwner };
