import {
  getStatusesByScope,
  createCustomStatus,
  updateStatusById,
  archiveStatus,
  restoreStatus,
} from "../services/bookingStatusServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";

const handleGetStatuses = async (req, res) => {
  try {
    const { orgId } = req.query;
    const userId = req.user.id;

    const statuses = orgId
      ? await getStatusesByScope(orgId, null)
      : await getStatusesByScope(null, userId);

    return httpResponse(res, generalStatus.SUCCESS, statuses);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleCreateStatus = async (req, res) => {
  try {
    const { label, color, actions, orgId } = req.body;
    const userId = req.user.id;

    const status = await createCustomStatus({
      label,
      color,
      actions,
      orgId: orgId || null,
      userId: orgId ? null : userId,
    });

    return httpResponse(res, generalStatus.CREATED, status);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUpdateStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const updated = await updateStatusById(req.params.id, req.body);
    return httpResponse(res, generalStatus.SUCCESS, updated);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleArchiveStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const archived = await archiveStatus(req.params.id);
    return httpResponse(res, generalStatus.SUCCESS, archived);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleRestoreStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const restored = await restoreStatus(req.params.id);
    return httpResponse(res, generalStatus.SUCCESS, restored);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export {
  handleGetStatuses,
  handleCreateStatus,
  handleUpdateStatus,
  handleArchiveStatus,
  handleRestoreStatus,
};
