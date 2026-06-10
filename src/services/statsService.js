import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { parseWallClockToUtc } from "../shared/utils/timezone.js";

const pickGranularity = (from, to) => {
  const msInDay = 86_400_000;
  const days = Math.floor((Date.parse(to) - Date.parse(from)) / msInDay) + 1;
  if (days <= 31)  return "day";
  if (days <= 180) return "week";
  return "month";
};

const buildScopeMatch = ({ scope, userId, orgId, staffId }) => {
  if (scope === "personal") {
    return { orgId: null, "hosts.userId": new mongoose.Types.ObjectId(userId) };
  }
  if (scope === "org-self") {
    return { orgId: new mongoose.Types.ObjectId(orgId), "hosts.userId": new mongoose.Types.ObjectId(userId) };
  }
  // org-admin
  const match = { orgId: new mongoose.Types.ObjectId(orgId) };
  if (staffId) match["hosts.userId"] = new mongoose.Types.ObjectId(staffId);
  return match;
};

const buildTimeseriesGroup = (granularity, timezone) => {
  if (granularity === "week") {
    return {
      $dateToString: {
        format: "%Y-%m-%d",
        timezone,
        date: {
          $dateFromParts: {
            isoWeekYear: { $isoWeekYear: { date: "$startAt", timezone } },
            isoWeek:     { $isoWeek:     { date: "$startAt", timezone } },
            isoDayOfWeek: 1,
          },
        },
      },
    };
  }
  const format = granularity === "day" ? "%Y-%m-%d" : "%Y-%m-01";
  return {
    $dateToString: { format, timezone, date: "$startAt" },
  };
};

const fillEmptyBuckets = (timeseries, from, to, granularity) => {
  const present = new Map(timeseries.map((p) => [p.date, p]));
  const filled = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end    = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    filled.push(present.get(key) || { date: key, bookingsCount: 0, totalAmount: 0 });
    if (granularity === "day")   cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (granularity === "week")  cursor.setUTCDate(cursor.getUTCDate() + 7);
    if (granularity === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return filled;
};

const collapseTopServicesOther = (top, totalCount, totalAmount) => {
  const top5 = top.slice(0, 5);
  const restCount  = totalCount  - top5.reduce((s, x) => s + x.bookingsCount, 0);
  const restAmount = totalAmount - top5.reduce((s, x) => s + x.totalAmount, 0);
  if (restCount <= 0) return top5;
  return [
    ...top5,
    { eventTypeId: "other", name: "Other", bookingsCount: restCount, totalAmount: restAmount },
  ];
};

const mongoDriver = {
  aggregateA: async ({ scope, userId, orgId, staffId, from, to, statusIds, timezone, granularity }) => {
    const fromUtc = parseWallClockToUtc(`${from}T00:00:00`,     timezone);
    const toUtc   = parseWallClockToUtc(`${to}T23:59:59.999`,   timezone);
    const match = {
      ...buildScopeMatch({ scope, userId, orgId, staffId }),
      startAt: { $gte: fromUtc, $lte: toUtc },
    };
    if (statusIds && statusIds.length > 0) {
      match.statusId = { $in: statusIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const tsGroup = buildTimeseriesGroup(granularity, timezone);

    const facetSpec = {
      kpi: [
        { $group: { _id: null, bookingsCount: { $sum: 1 }, totalAmount: { $sum: "$payment.amount" } } },
        { $project: { _id: 0, bookingsCount: 1, totalAmount: 1 } },
      ],
      timeseries: [
        { $group: { _id: tsGroup, bookingsCount: { $sum: 1 }, totalAmount: { $sum: "$payment.amount" } } },
        { $project: { _id: 0, date: "$_id", bookingsCount: 1, totalAmount: 1 } },
        { $sort: { date: 1 } },
      ],
      topServices: [
        { $group: { _id: "$eventTypeId", bookingsCount: { $sum: 1 }, totalAmount: { $sum: "$payment.amount" } } },
        { $lookup: { from: "eventtypes", localField: "_id", foreignField: "_id", as: "et" } },
        { $project: {
            _id: 0,
            eventTypeId: { $toString: "$_id" },
            name:        { $ifNull: [{ $arrayElemAt: ["$et.name", 0] }, "(deleted)"] },
            bookingsCount: 1,
            totalAmount: 1,
          },
        },
        { $sort: { bookingsCount: -1 } },
      ],
    };

    if (scope === "org-admin") {
      facetSpec.topStaff = [
        { $unwind: "$hosts" },
        { $group: { _id: "$hosts.userId", bookingsCount: { $sum: 1 }, totalAmount: { $sum: "$payment.amount" } } },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
        { $project: {
            _id: 0,
            staffId: { $toString: "$_id" },
            name:    { $ifNull: [{ $arrayElemAt: ["$u.name",   0] }, "(deleted)"] },
            avatar:  { $ifNull: [{ $arrayElemAt: ["$u.avatar", 0] }, "" ] },
            bookingsCount: 1,
            totalAmount: 1,
          },
        },
        { $sort: { bookingsCount: -1 } },
        { $limit: 10 },
      ];
    }

    return Booking.aggregate([{ $match: match }, { $facet: facetSpec }]);
  },

  aggregateB: async ({ scope, userId, orgId, staffId, from, to, timezone }) => {
    const fromUtc = parseWallClockToUtc(`${from}T00:00:00`,     timezone);
    const toUtc   = parseWallClockToUtc(`${to}T23:59:59.999`,   timezone);
    const match = {
      ...buildScopeMatch({ scope, userId, orgId, staffId }),
      startAt: { $gte: fromUtc, $lte: toUtc },
    };
    return Booking.aggregate([
      { $match: match },
      { $group: { _id: "$statusId", bookingsCount: { $sum: 1 }, totalAmount: { $sum: "$payment.amount" } } },
      { $lookup: { from: "bookingstatuses", localField: "_id", foreignField: "_id", as: "s" } },
      { $project: {
          _id: 0,
          statusId: { $toString: "$_id" },
          label:    { $ifNull: [{ $arrayElemAt: ["$s.label", 0] }, "(deleted)"] },
          color:    { $ifNull: [{ $arrayElemAt: ["$s.color", 0] }, "#9CA3AF"] },
          bookingsCount: 1,
          totalAmount: 1,
        },
      },
      { $sort: { bookingsCount: -1 } },
    ]);
  },
};

const buildBookingStats = async ({
  scope, userId, orgId, staffId, from, to, statusIds, timezone, currency,
  driver = mongoDriver,
}) => {
  const granularity = pickGranularity(from, to);

  const [resultA, byStatus] = await Promise.all([
    driver.aggregateA({ scope, userId, orgId, staffId, from, to, statusIds, timezone, granularity }),
    driver.aggregateB({ scope, userId, orgId, staffId, from, to, timezone, granularity }),
  ]);

  const facet      = resultA[0] || { kpi: [], timeseries: [], topServices: [], topStaff: [] };
  const kpiBucket  = facet.kpi[0] || { bookingsCount: 0, totalAmount: 0 };
  const avgTicket  = kpiBucket.bookingsCount === 0
    ? 0
    : Math.round(kpiBucket.totalAmount / kpiBucket.bookingsCount);

  const timeseries  = fillEmptyBuckets(facet.timeseries, from, to, granularity);
  const topServices = collapseTopServicesOther(facet.topServices, kpiBucket.bookingsCount, kpiBucket.totalAmount);

  const response = {
    currency,
    timezone,
    granularity,
    kpi: { bookingsCount: kpiBucket.bookingsCount, totalAmount: kpiBucket.totalAmount, avgTicket },
    timeseries,
    topServices,
    byStatus,
  };
  if (scope === "org-admin") response.topStaff = facet.topStaff;
  return response;
};

export { buildBookingStats, pickGranularity };
