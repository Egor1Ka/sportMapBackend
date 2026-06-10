import {
  getPositionsByOrgId as repoGetByOrg,
  createPosition as repoCreate,
  updatePosition as repoUpdate,
  deletePosition as repoDelete,
} from "../repository/positionRepository.js";
import { countByPositionId } from "../repository/membershipRepository.js";
import EventType from "../models/EventType.js";
import { HttpError } from "../shared/utils/http/httpError.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";

const addStaffCount = async (position) => {
  const staffCount = await countByPositionId(position.id);
  return { ...position, staffCount };
};

const getPositionsByOrg = async (orgId) => {
  const positions = await repoGetByOrg(orgId);
  return Promise.all(positions.map(addStaffCount));
};

const createPosition = async (orgId, data) => {
  return repoCreate({ ...data, orgId });
};

const updatePosition = async (id, data) => {
  const position = await repoUpdate(id, data);
  if (!position) {
    throw new HttpError(generalStatus.NOT_FOUND);
  }
  return position;
};

const deletePosition = async (id) => {
  const staffCount = await countByPositionId(id);
  if (staffCount > 0) {
    throw new HttpError(
      { status: 400, message: "badRequest", appStatusCode: 400 },
      { reason: "Position has assigned staff members. Unassign them first." }
    );
  }

  const eventTypeCount = await EventType.countDocuments({ assignedPositions: id });
  if (eventTypeCount > 0) {
    throw new HttpError(
      { status: 400, message: "badRequest", appStatusCode: 400 },
      { reason: "Position is used in services. Remove it from services first." }
    );
  }

  const deleted = await repoDelete(id);
  if (!deleted) {
    throw new HttpError(generalStatus.NOT_FOUND);
  }
  return deleted;
};

export { getPositionsByOrg, createPosition, updatePosition, deletePosition };
