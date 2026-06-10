import {
  findActiveTemplateDto,
  findCurrentTemplate,
  createTemplate,
  updateTemplateValidTo,
  findActiveTemplatesByOrg,
} from "../repository/scheduleTemplateRepository.js";
import { upsertOverride, findOverridesByStaff, deleteOverrideById, findOverridesByOrg } from "../repository/scheduleOverrideRepository.js";
import { getRawOrgById } from "../repository/organizationRepository.js";
import {
  DEFAULT_WEEKLY_HOURS,
  DEFAULT_SLOT_MODE,
  DEFAULT_SLOT_STEP_MIN,
} from "../constants/schedule.js";
import { todayInTz, addDaysToDateStr, parseWallClockToUtc, isValidTimezone, getOrgTimezone, resolveScheduleTimezone } from "../shared/utils/timezone.js";

const getActiveTemplate = async (staffId, orgId, locationId, date) => {
  return findActiveTemplateDto(staffId, orgId, locationId, date);
};

const resolveStaffTimezone = async ({ staffId, orgId = null, locationId = null }) => {
  const now = new Date();
  const template = await findActiveTemplateDto(staffId, orgId, locationId, now);
  if (!template) {
    if (orgId) {
      const orgTz = await getOrgTimezone(orgId);
      return orgTz ?? null;
    }
    return null;
  }
  return await resolveScheduleTimezone(template, getOrgTimezone);
};

const createDefaultSchedule = async (staffId, orgId = null, timezone = null) => {
  const resolvedTz = orgId
    ? await getOrgTimezone(orgId)
    : timezone;
  if (!resolvedTz || !isValidTimezone(resolvedTz)) {
    throw new Error("timezone_required");
  }

  const existing = await findCurrentTemplate(staffId, orgId, null);
  if (existing) return null;

  const todayStr = todayInTz(resolvedTz);
  const todayUtc = parseWallClockToUtc(`${todayStr}T00:00:00`, resolvedTz);

  const template = await createTemplate({
    staffId,
    orgId,
    locationId: null,
    validFrom: todayUtc,
    validTo: null,
    timezone: orgId ? null : resolvedTz,
    slotMode: DEFAULT_SLOT_MODE,
    slotStepMin: DEFAULT_SLOT_STEP_MIN,
    weeklyHours: DEFAULT_WEEKLY_HOURS,
  });

  return template;
};

const rotateTemplate = async ({ staffId, orgId, locationId, weeklyHours, slotMode, slotStepMin, timezone, currency }) => {
  const resolvedTimezone = orgId
    ? await getOrgTimezone(orgId)
    : timezone;
  if (!resolvedTimezone || !isValidTimezone(resolvedTimezone)) {
    throw new Error("timezone_required");
  }
  const todayStr = todayInTz(resolvedTimezone);
  const todayUtc = parseWallClockToUtc(`${todayStr}T00:00:00`, resolvedTimezone);
  const yesterdayStr = addDaysToDateStr(todayStr, -1);
  const yesterdayUtc = parseWallClockToUtc(`${yesterdayStr}T00:00:00`, resolvedTimezone);

  const current = await findCurrentTemplate(staffId, orgId, locationId);
  if (current) {
    await updateTemplateValidTo(current._id, yesterdayUtc);
  }

  // Currency живёт ТОЛЬКО у личных шаблонов (orgId=null).
  // Для оргшних — currency читается из Organization, поле в шаблоне не используется.
  // Если currency не передан — наследуем из предыдущего шаблона или ставим "UAH".
  const resolvedCurrency = orgId
    ? null
    : (currency || current?.currency || "UAH");

  const newTemplate = await createTemplate({
    staffId,
    orgId: orgId || null,
    locationId: locationId || null,
    validFrom: todayUtc,
    validTo: null,
    timezone: orgId ? null : resolvedTimezone,
    currency: resolvedCurrency,
    slotMode: slotMode || "fixed",
    slotStepMin: slotStepMin ?? 30,
    weeklyHours,
  });

  return newTemplate;
};

const upsertScheduleOverride = async (data) => {
  return upsertOverride(data);
};

const getOverridesByStaff = async (staffId, orgId) => {
  return findOverridesByStaff(staffId, orgId);
};

const deleteOverride = async (id) => {
  return deleteOverrideById(id);
};

const getOverridesByOrg = async (orgId) => {
  return findOverridesByOrg(orgId);
};

const getActiveTemplatesByOrg = async (orgId) => {
  const org = await getRawOrgById(orgId);
  if (!org || !org.timezone) throw new Error("org_timezone_required");
  const orgTimezone = org.timezone;
  const todayStr = todayInTz(orgTimezone);
  const todayUtc = parseWallClockToUtc(`${todayStr}T00:00:00`, orgTimezone);
  return findActiveTemplatesByOrg(orgId, todayUtc);
};

export { getActiveTemplate, resolveStaffTimezone, createDefaultSchedule, rotateTemplate, upsertScheduleOverride, getOverridesByStaff, deleteOverride, getOverridesByOrg, getActiveTemplatesByOrg };
