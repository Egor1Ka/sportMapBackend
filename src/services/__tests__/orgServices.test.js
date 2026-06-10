import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWallClockToUtc, isValidTimezone } from "../../shared/utils/timezone.js";

// getDayRange pure logic — mirrors src/services/orgServices.js getDayRange
const getDayRange = (dateStr, timezone) => {
  if (!timezone) throw new Error("timezone_required");
  const isoStart = `${dateStr}T00:00:00.000Z`;
  const isoEnd = `${dateStr}T23:59:59.999Z`;
  return {
    start: parseWallClockToUtc(isoStart, timezone),
    end: parseWallClockToUtc(isoEnd, timezone),
  };
};

describe("getDayRange", () => {
  it("start anchored to Kyiv midnight — независимо от server TZ (UTC+3 DST)", () => {
    const { start, end } = getDayRange("2026-04-18", "Europe/Kyiv");
    assert.equal(start.toISOString(), "2026-04-17T21:00:00.000Z");
    assert.equal(end.toISOString(), "2026-04-18T20:59:59.999Z");
  });

  it("throws when timezone is missing", () => {
    assert.throws(() => getDayRange("2026-04-18", undefined), /timezone_required/);
  });

  it("start anchored to UTC midnight", () => {
    const { start, end } = getDayRange("2026-04-18", "UTC");
    assert.equal(start.toISOString(), "2026-04-18T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-04-18T23:59:59.999Z");
  });

  it("New York (UTC-4 DST) — start is 04:00 UTC", () => {
    const { start } = getDayRange("2026-04-18", "America/New_York");
    assert.equal(start.toISOString(), "2026-04-18T04:00:00.000Z");
  });
});

// createOrganization timezone guard — mirrors the guard in src/services/orgServices.js
const validateOrgTimezone = (data) => {
  if (!data.timezone || !isValidTimezone(data.timezone)) {
    throw new Error("timezone_required");
  }
};

describe("createOrganization timezone guard", () => {
  it("throws timezone_required when timezone is absent", () => {
    assert.throws(() => validateOrgTimezone({ name: "X" }), /timezone_required/);
  });

  it("throws timezone_required when timezone is an invalid string", () => {
    assert.throws(() => validateOrgTimezone({ name: "X", timezone: "Not/Valid" }), /timezone_required/);
  });

  it("does not throw for a valid IANA timezone", () => {
    assert.doesNotThrow(() => validateOrgTimezone({ name: "X", timezone: "Europe/Kyiv" }));
  });

  it("does not throw for UTC", () => {
    assert.doesNotThrow(() => validateOrgTimezone({ name: "X", timezone: "UTC" }));
  });
});
