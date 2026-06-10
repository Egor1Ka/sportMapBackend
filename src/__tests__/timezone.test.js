import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getTimezoneOffsetMin,
  parseWallClockToUtc,
  isValidTimezone,
  getDayOfWeekInTz,
  resolveScheduleTimezone,
} from "../shared/utils/timezone.js";
import { getDateRangeForTest } from "../services/slotServices.js";

test("getTimezoneOffsetMin: Europe/Kyiv in April (DST) = +180", () => {
  const d = new Date("2026-04-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "Europe/Kyiv"), 180);
});

test("getTimezoneOffsetMin: Europe/Kyiv in January (no DST) = +120", () => {
  const d = new Date("2026-01-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "Europe/Kyiv"), 120);
});

test("getTimezoneOffsetMin: UTC = 0", () => {
  const d = new Date("2026-04-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "UTC"), 0);
});

test("getTimezoneOffsetMin: America/Los_Angeles April (DST) = -420", () => {
  const d = new Date("2026-04-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "America/Los_Angeles"), -420);
});

test("getTimezoneOffsetMin: Asia/Kolkata (half-hour offset) = +330", () => {
  const d = new Date("2026-04-15T12:00:00Z");
  assert.equal(getTimezoneOffsetMin(d, "Asia/Kolkata"), 330);
});

test("isValidTimezone: корректная IANA", () => {
  assert.equal(isValidTimezone("Europe/Kyiv"), true);
  assert.equal(isValidTimezone("UTC"), true);
  assert.equal(isValidTimezone("America/Los_Angeles"), true);
});

test("isValidTimezone: некорректная строка", () => {
  assert.equal(isValidTimezone("Not/Real"), false);
  assert.equal(isValidTimezone(""), false);
  assert.equal(isValidTimezone(null), false);
  assert.equal(isValidTimezone(undefined), false);
});

test("getDayOfWeekInTz: 2026-04-15 в Europe/Kyiv = wed", () => {
  assert.equal(getDayOfWeekInTz("2026-04-15", "Europe/Kyiv"), "wed");
});

test("getDayOfWeekInTz: 2026-04-19 в UTC = sun", () => {
  assert.equal(getDayOfWeekInTz("2026-04-19", "UTC"), "sun");
});

test("getDayOfWeekInTz: одна дата, разные tz — weekday стабилен (используется 12:00 UTC anchor)", () => {
  assert.equal(getDayOfWeekInTz("2026-04-15", "America/Los_Angeles"), "wed");
  assert.equal(getDayOfWeekInTz("2026-04-15", "Asia/Tokyo"), "wed");
});

test("getDateRange: 2026-04-15 в Europe/Kyiv (+3 DST) → 2026-04-14T21:00 .. 2026-04-15T20:59:59.999", () => {
  const { dateStart, dateEnd } = getDateRangeForTest("2026-04-15", "Europe/Kyiv");
  assert.equal(dateStart.toISOString(), "2026-04-14T21:00:00.000Z");
  assert.equal(dateEnd.toISOString(), "2026-04-15T20:59:59.999Z");
});

test("getDateRange: 2026-04-15 в UTC → 2026-04-15T00:00 .. 2026-04-15T23:59:59.999", () => {
  const { dateStart, dateEnd } = getDateRangeForTest("2026-04-15", "UTC");
  assert.equal(dateStart.toISOString(), "2026-04-15T00:00:00.000Z");
  assert.equal(dateEnd.toISOString(), "2026-04-15T23:59:59.999Z");
});

test("getDateRange: 2026-04-15 в America/Los_Angeles (-7 DST) → 2026-04-15T07:00 .. 2026-04-16T06:59:59.999", () => {
  const { dateStart, dateEnd } = getDateRangeForTest("2026-04-15", "America/Los_Angeles");
  assert.equal(dateStart.toISOString(), "2026-04-15T07:00:00.000Z");
  assert.equal(dateEnd.toISOString(), "2026-04-16T06:59:59.999Z");
});

test("parseWallClockToUtc: basic conversion Europe/Kyiv 14:00 (DST +3)", () => {
  const result = parseWallClockToUtc("2026-04-15T14:00:00", "Europe/Kyiv");
  assert.equal(result.toISOString(), "2026-04-15T11:00:00.000Z");
});

test("parseWallClockToUtc: UTC passthrough", () => {
  const result = parseWallClockToUtc("2026-04-15T14:00:00", "UTC");
  assert.equal(result.toISOString(), "2026-04-15T14:00:00.000Z");
});

test("parseWallClockToUtc: America/New_York 10:00 (DST -4)", () => {
  const result = parseWallClockToUtc("2026-04-15T10:00:00", "America/New_York");
  assert.equal(result.toISOString(), "2026-04-15T14:00:00.000Z");
});

test("parseWallClockToUtc: strips Z suffix and parses as wall-clock", () => {
  const result = parseWallClockToUtc("2026-04-15T14:00:00Z", "Europe/Kyiv");
  assert.equal(result.toISOString(), "2026-04-15T11:00:00.000Z");
});

test("parseWallClockToUtc: DST spring-forward — 04:30 Kyiv on transition day", () => {
  const result = parseWallClockToUtc("2026-03-29T04:30:00", "Europe/Kyiv");
  assert.equal(result.toISOString(), "2026-03-29T01:30:00.000Z");
});

test("parseWallClockToUtc: null input returns epoch (Date(null) = Date(0))", () => {
  const r1 = parseWallClockToUtc(null, "UTC");
  assert.equal(r1.getTime(), new Date(null).getTime());
});

test("parseWallClockToUtc: null timezone returns naive Date", () => {
  const r2 = parseWallClockToUtc("2026-04-15T10:00:00", null);
  assert.ok(!isNaN(r2.getTime()));
});

test("resolveScheduleTimezone: org template uses org timezone", async () => {
  const template = { timezone: null, orgId: "org1" };
  const getOrgTz = async (orgId) => orgId === "org1" ? "Europe/Kyiv" : null;
  const result = await resolveScheduleTimezone(template, getOrgTz);
  assert.equal(result, "Europe/Kyiv");
});

test("resolveScheduleTimezone: personal template uses template timezone", async () => {
  const template = { timezone: "America/New_York", orgId: null };
  const getOrgTz = async () => null;
  const result = await resolveScheduleTimezone(template, getOrgTz);
  assert.equal(result, "America/New_York");
});

test("resolveScheduleTimezone: fallback to UTC when org has no timezone", async () => {
  const template = { timezone: null, orgId: "org1" };
  const getOrgTz = async () => null;
  const result = await resolveScheduleTimezone(template, getOrgTz);
  assert.equal(result, "UTC");
});

test("resolveScheduleTimezone: personal template without timezone falls back to UTC", async () => {
  const template = { timezone: null, orgId: null };
  const getOrgTz = async () => null;
  const result = await resolveScheduleTimezone(template, getOrgTz);
  assert.equal(result, "UTC");
});
