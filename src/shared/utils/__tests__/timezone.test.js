import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { wallClockInTz, todayInTz, addDaysToDateStr } from "../timezone.js";

describe("wallClockInTz", () => {
  it("returns Kyiv wall-clock for UTC iso in DST", () => {
    assert.deepEqual(
      wallClockInTz("2026-04-18T06:00:00Z", "Europe/Kyiv"),
      { year: 2026, month: 4, day: 18, hour: 9, minute: 0, dayOfWeek: 6 }
    );
  });

  it("returns Berlin wall-clock for same iso", () => {
    assert.equal(
      wallClockInTz("2026-04-18T06:00:00Z", "Europe/Berlin").hour,
      8
    );
  });

  it("handles midnight wraparound", () => {
    const result = wallClockInTz("2026-04-18T23:30:00Z", "Europe/Kyiv");
    assert.equal(result.day, 19);
    assert.equal(result.hour, 2);
    assert.equal(result.minute, 30);
  });

  it("dayOfWeek: Sunday is 0", () => {
    assert.equal(
      wallClockInTz("2026-04-19T12:00:00Z", "Europe/Kyiv").dayOfWeek,
      0
    );
  });
});

test("todayInTz returns YYYY-MM-DD format", () => {
  const today = todayInTz("Europe/Kyiv");
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
});

test("addDaysToDateStr handles month boundary forward", () => {
  assert.equal(addDaysToDateStr("2026-03-31", 1), "2026-04-01");
});

test("addDaysToDateStr handles month boundary backward", () => {
  assert.equal(addDaysToDateStr("2026-04-01", -1), "2026-03-31");
});

test("addDaysToDateStr year boundary", () => {
  assert.equal(addDaysToDateStr("2025-12-31", 1), "2026-01-01");
});
