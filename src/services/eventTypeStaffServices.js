import { getEventTypeById } from "../repository/eventTypeRepository.js";
import {
  getActiveMembersByOrg,
  getActiveMembersByPositions,
  getActiveMembersByUserIds,
} from "../repository/membershipRepository.js";
import { getUserById } from "../modules/user/index.js";
import { getPositionById } from "../repository/positionRepository.js";
import { toOrgStaffDto } from "../dto/staffDto.js";

// Фильтр для удаления null-значений из массива
const isNotNull = (item) => item !== null;

// Формирование профиля сотрудника по записи участника организации
const buildStaffProfile = async (member) => {
  const user = await getUserById(member.userId.toString());
  if (!user) return null;

  const position = member.positionId
    ? await getPositionById(member.positionId)
    : null;

  return toOrgStaffDto(user, position, 0, member.status, member);
};

// Обработчики для каждого типа политики назначения сотрудников
const POLICY_HANDLERS = {
  any: (eventType) => getActiveMembersByOrg(eventType.orgId),
  by_position: (eventType) =>
    getActiveMembersByPositions(eventType.orgId, eventType.assignedPositions),
  specific: (eventType) =>
    getActiveMembersByUserIds(eventType.orgId, eventType.assignedStaff),
};

// Получение списка сотрудников, которые могут выполнять данный тип события
const getStaffForEventType = async (eventTypeId) => {
  const eventType = await getEventTypeById(eventTypeId);
  if (!eventType) return { error: "event_type_not_found" };
  if (!eventType.orgId) return { error: "not_org_event_type" };

  const getMembers = POLICY_HANDLERS[eventType.staffPolicy] ?? POLICY_HANDLERS.any;
  const members = await getMembers(eventType);

  const profiles = await Promise.all(members.map(buildStaffProfile));
  return { staff: profiles.filter(isNotNull) };
};

export { getStaffForEventType };
