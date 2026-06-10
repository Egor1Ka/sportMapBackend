import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { buildBookingStats, pickGranularity } from "../services/statsService.js";

test("statsService: returns zeroed stats when no bookings match", async () => {
  // Эта проверка работает чисто на shape ответа — не зависит от подключения к Mongo,
  // потому что мы прокинем фейк-агрегатор. Нужен ровно один параметр — driver.
  const fakeDriver = {
    aggregateA: async () => [{
      kpi:        [{ bookingsCount: 0, totalAmount: 0 }],
      timeseries: [],
      topServices: [],
      topStaff:    [],
    }],
    aggregateB: async () => [],
  };

  const result = await buildBookingStats({
    scope: "personal",
    userId: new mongoose.Types.ObjectId(),
    from: "2026-04-01",
    to: "2026-04-30",
    statusIds: null,
    timezone: "UTC",
    currency: "UAH",
    driver: fakeDriver,
  });

  assert.equal(result.currency, "UAH");
  assert.equal(result.timezone, "UTC");
  assert.equal(result.granularity, "day");
  assert.deepEqual(result.kpi, { bookingsCount: 0, totalAmount: 0, avgTicket: 0 });
  assert.deepEqual(result.byStatus, []);
  assert.equal(result.timeseries.length, 30);
  assert.equal(result.timeseries[0].date,  "2026-04-01");
  assert.equal(result.timeseries[29].date, "2026-04-30");
  assert.deepEqual(result.timeseries[15], { date: "2026-04-16", bookingsCount: 0, totalAmount: 0 });
  assert.deepEqual(result.topServices, []);
  assert.equal(result.topStaff, undefined);  // personal scope → no topStaff
});

test("pickGranularity: 1 day → day", () => {
  assert.equal(pickGranularity("2026-04-01", "2026-04-01"), "day");
});

test("pickGranularity: 31 days → day", () => {
  assert.equal(pickGranularity("2026-04-01", "2026-05-01"), "day");
});

test("pickGranularity: 32 days → week", () => {
  assert.equal(pickGranularity("2026-04-01", "2026-05-02"), "week");
});

test("pickGranularity: 180 days → week", () => {
  assert.equal(pickGranularity("2026-01-01", "2026-06-29"), "week");
});

test("pickGranularity: 181 days → month", () => {
  assert.equal(pickGranularity("2026-01-01", "2026-06-30"), "month");
});
