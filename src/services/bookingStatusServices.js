import {
  createStatus,
  createManyStatuses,
  findByScope,
  findById,
  updateStatus,
  findByLabel,
  countByScope,
} from "../repository/bookingStatusRepository.js";
import {
  VALID_ACTIONS,
  DEFAULT_STATUSES,
  isAllowedColor,
} from "../constants/bookingStatus.js";
import { HttpError } from "../shared/utils/http/httpError.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import Organization from "../models/Organization.js";
import User from "../modules/user/model/User.js";

/**
 * Создать 4 дефолтных статуса для scope (org или personal).
 * Возвращает массив созданных статусов.
 * Устанавливает defaultBookingStatusId на status_unconfirmed.
 */
const seedDefaultStatuses = async (orgId, userId = null) => {
  console.log("[seedDefaultStatuses] called with orgId:", orgId, "userId:", userId);
  const existing = await countByScope(orgId, userId);
  console.log("[seedDefaultStatuses] existing count:", existing);
  if (existing > 0) return [];

  const toStatusData = (template) => ({
    ...template,
    orgId: orgId || null,
    userId: orgId ? null : userId,
  });
  const statusDataArray = DEFAULT_STATUSES.map(toStatusData);
  console.log("[seedDefaultStatuses] inserting", statusDataArray.length, "statuses");
  const created = await createManyStatuses(statusDataArray);
  console.log("[seedDefaultStatuses] created", created.length, "statuses");

  // Установить defaultBookingStatusId = status_unconfirmed
  const unconfirmed = created.find((s) => s.label === "status_unconfirmed");
  console.log("[seedDefaultStatuses] unconfirmed status:", unconfirmed ? unconfirmed.id : "NOT FOUND");
  if (unconfirmed) {
    if (orgId) {
      await Organization.findByIdAndUpdate(orgId, {
        defaultBookingStatusId: unconfirmed.id,
      });
    } else if (userId) {
      await User.findByIdAndUpdate(userId, {
        defaultBookingStatusId: unconfirmed.id,
      });
    }
    console.log("[seedDefaultStatuses] defaultBookingStatusId set");
  }

  return created;
};

const getStatusesByScope = async (orgId, userId) => {
  return findByScope(orgId, userId);
};

const createCustomStatus = async ({ label, color, actions, orgId, userId }) => {
  if (!label || !label.trim()) {
    throw new HttpError(generalStatus.BAD_REQUEST);
  }
  if (!isAllowedColor(color)) {
    throw new HttpError(generalStatus.BAD_REQUEST);
  }
  const invalidAction = (actions || []).find((a) => !VALID_ACTIONS.includes(a));
  if (invalidAction) {
    throw new HttpError(generalStatus.BAD_REQUEST);
  }

  // Проверить уникальность label в scope
  const duplicate = await findByLabel(label, orgId, userId);
  if (duplicate) {
    throw new HttpError(generalStatus.BAD_REQUEST);
  }

  const nextOrder = await countByScope(orgId, userId);

  return createStatus({
    label,
    color,
    actions: actions || [],
    isDefault: false,
    isArchived: false,
    orgId: orgId || null,
    userId: orgId ? null : userId,
    order: nextOrder,
  });
};

const updateStatusById = async (id, updates) => {
  const existing = await findById(id);
  if (!existing) throw new HttpError(generalStatus.NOT_FOUND);

  const allowed = {};
  if (updates.label !== undefined) allowed.label = updates.label;
  if (updates.color !== undefined) {
    if (!isAllowedColor(updates.color)) {
      throw new HttpError(generalStatus.BAD_REQUEST);
    }
    allowed.color = updates.color;
  }
  if (updates.actions !== undefined) {
    const invalidAction = updates.actions.find((a) => !VALID_ACTIONS.includes(a));
    if (invalidAction) {
      throw new HttpError(generalStatus.BAD_REQUEST);
    }
    allowed.actions = updates.actions;
  }
  if (updates.order !== undefined) allowed.order = updates.order;

  return updateStatus(id, allowed);
};

const archiveStatus = async (id) => {
  const existing = await findById(id);
  if (!existing) throw new HttpError(generalStatus.NOT_FOUND);

  // Нельзя архивировать дефолтный статус для новых бронирований
  const isOrgDefault = existing.orgId
    ? await Organization.findOne({ _id: existing.orgId, defaultBookingStatusId: id })
    : null;
  const isUserDefault = existing.userId
    ? await User.findOne({ _id: existing.userId, defaultBookingStatusId: id })
    : null;

  if (isOrgDefault || isUserDefault) {
    throw new HttpError(generalStatus.BAD_REQUEST);
  }

  return updateStatus(id, { isArchived: true });
};

const restoreStatus = async (id) => {
  const existing = await findById(id);
  if (!existing) throw new HttpError(generalStatus.NOT_FOUND);

  return updateStatus(id, { isArchived: false });
};

export {
  seedDefaultStatuses,
  getStatusesByScope,
  createCustomStatus,
  updateStatusById,
  archiveStatus,
  restoreStatus,
};
