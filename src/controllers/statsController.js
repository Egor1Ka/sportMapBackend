import mongoose from "mongoose";
import Organization from "../models/Organization.js";
import ScheduleTemplate from "../models/ScheduleTemplate.js";
import { buildBookingStats } from "../services/statsService.js";
import { httpResponse } from "../shared/utils/http/httpResponse.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";

const isIsoDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const parseStatsQuery = (req) => {
  const { from, to, statusIds, staffId } = req.query;
  if (!isIsoDate(from) || !isIsoDate(to)) return null;
  if (Date.parse(from) > Date.parse(to)) return null;
  return {
    from,
    to,
    statusIds: typeof statusIds === "string" && statusIds.length > 0
      ? statusIds.split(",").filter(Boolean)
      : null,
    staffId:   typeof staffId === "string" && mongoose.Types.ObjectId.isValid(staffId)
      ? staffId
      : null,
  };
};

const handlePersonalStats = async (req, res) => {
  try {
    const query = parseStatsQuery(req);
    if (!query) {
      httpResponse(res, generalStatus.BAD_REQUEST, { message: "Invalid query parameters" });
      return;
    }
    // Личное расписание: timezone и currency живут на ScheduleTemplate (orgId=null).
    // Если шаблона ещё нет — деграндируем до дефолтов "UTC" / "UAH".
    const personalTemplate = await ScheduleTemplate.findOne({
      staffId: req.user.id,
      orgId: null,
      validTo: null,
    }).select("timezone currency");
    const data = await buildBookingStats({
      scope:    "personal",
      userId:   req.user.id,
      from:     query.from,
      to:       query.to,
      statusIds: query.statusIds,
      timezone: personalTemplate?.timezone || "UTC",
      currency: personalTemplate?.currency || "UAH",
    });
    httpResponse(res, generalStatus.SUCCESS, data);
  } catch (error) {
    console.error("handlePersonalStats error:", error);
    httpResponse(res, generalStatus.ERROR);
  }
};

const handleOrgStats = async (req, res) => {
  try {
    const query = parseStatsQuery(req);
    if (!query) {
      httpResponse(res, generalStatus.BAD_REQUEST, { message: "Invalid query parameters" });
      return;
    }
    const org = await Organization.findById(req.params.orgId).select("timezone currency");
    if (!org) {
      httpResponse(res, generalStatus.NOT_FOUND);
      return;
    }
    const data = await buildBookingStats({
      scope:    "org-admin",
      orgId:    req.params.orgId,
      staffId:  query.staffId,
      from:     query.from,
      to:       query.to,
      statusIds: query.statusIds,
      timezone: org.timezone,
      currency: org.currency,
    });
    httpResponse(res, generalStatus.SUCCESS, data);
  } catch (error) {
    console.error("handleOrgStats error:", error);
    httpResponse(res, generalStatus.ERROR);
  }
};

const handleOrgSelfStats = async (req, res) => {
  try {
    const query = parseStatsQuery(req);
    if (!query) {
      httpResponse(res, generalStatus.BAD_REQUEST, { message: "Invalid query parameters" });
      return;
    }
    const org = await Organization.findById(req.params.orgId).select("timezone currency");
    if (!org) {
      httpResponse(res, generalStatus.NOT_FOUND);
      return;
    }
    const data = await buildBookingStats({
      scope:    "org-self",
      orgId:    req.params.orgId,
      userId:   req.user.id,
      from:     query.from,
      to:       query.to,
      statusIds: query.statusIds,
      timezone: org.timezone,
      currency: org.currency,
    });
    httpResponse(res, generalStatus.SUCCESS, data);
  } catch (error) {
    console.error("handleOrgSelfStats error:", error);
    httpResponse(res, generalStatus.ERROR);
  }
};

export { handlePersonalStats, handleOrgStats, handleOrgSelfStats, parseStatsQuery };
