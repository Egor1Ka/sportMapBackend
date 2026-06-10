import { getRawOrgById } from "../../repository/organizationRepository.js";

const getTimezoneOffsetMin = (date, timezone) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
    hour: "numeric",
  }).formatToParts(date);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");
  if (!offsetPart) return 0;
  const match = offsetPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + minutes);
};

// Parses ISO string whose wall-clock components represent local time in `timezone`
// (the `Z` suffix, if present, is ignored) and returns a proper UTC Date.
const parseWallClockToUtc = (isoString, timezone) => {
  if (!isoString || !timezone) return new Date(isoString);
  // Strip any trailing Z or offset — treat digits as wall-clock in `timezone`
  const cleaned = isoString.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const parts = cleaned.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!parts) return new Date(isoString);
  const year = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10) - 1;
  const day = parseInt(parts[3], 10);
  const hour = parseInt(parts[4], 10);
  const minute = parseInt(parts[5], 10);
  const second = parts[6] ? parseInt(parts[6], 10) : 0;
  // Create a UTC date with the same digits as the wall-clock time
  const naive = new Date(Date.UTC(year, month, day, hour, minute, second));
  // First pass: compute offset at the naive UTC instant
  const offset1 = getTimezoneOffsetMin(naive, timezone);
  const candidate = new Date(naive.getTime() - offset1 * 60000);
  // Second pass: verify offset at the candidate instant (DST safety)
  const offset2 = getTimezoneOffsetMin(candidate, timezone);
  if (offset1 !== offset2) {
    return new Date(naive.getTime() - offset2 * 60000);
  }
  return candidate;
};

const isValidTimezone = (tz) => {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const WEEKDAY_MAP = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

const WEEKDAY_NUM_MAP = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const getPart = (parts, type) => {
  const p = parts.find((x) => x.type === type);
  return p ? parseInt(p.value, 10) : 0;
};

const getWeekdayPart = (parts) => {
  const p = parts.find((x) => x.type === "weekday");
  return p ? p.value : "Sun";
};

const wallClockInTz = (iso, timezone) => {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(d);
  const hour = getPart(parts, "hour") % 24;
  return {
    year: getPart(parts, "year"),
    month: getPart(parts, "month"),
    day: getPart(parts, "day"),
    hour,
    minute: getPart(parts, "minute"),
    dayOfWeek: WEEKDAY_NUM_MAP[getWeekdayPart(parts)] ?? 0,
  };
};

const getDayOfWeekInTz = (dateStr, timezone) => {
  const anchor = new Date(`${dateStr}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).format(anchor);
  return WEEKDAY_MAP[weekday] || "sun";
};

const todayInTz = (timezone) => {
  const wc = wallClockInTz(new Date().toISOString(), timezone);
  return `${wc.year}-${String(wc.month).padStart(2, "0")}-${String(wc.day).padStart(2, "0")}`;
};

const addDaysToDateStr = (dateStr, days) => {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
};

const getOrgTimezone = async (orgId) => {
  if (!orgId) return null;
  const org = await getRawOrgById(orgId);
  return org?.timezone ?? null;
};

const resolveScheduleTimezone = async (template, getOrgTimezone) => {
  if (template.orgId) {
    const orgTz = await getOrgTimezone(template.orgId);
    return orgTz || "UTC";
  }
  return template.timezone || "UTC";
};

export {
  getTimezoneOffsetMin,
  parseWallClockToUtc,
  isValidTimezone,
  getDayOfWeekInTz,
  wallClockInTz,
  todayInTz,
  addDaysToDateStr,
  getOrgTimezone,
  resolveScheduleTimezone,
};
