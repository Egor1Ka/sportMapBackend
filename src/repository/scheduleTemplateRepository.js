import ScheduleTemplate from "../models/ScheduleTemplate.js";
import { toScheduleTemplateDto } from "../dto/scheduleDto.js";
import { getActiveMembersByOrg } from "./membershipRepository.js";

const buildTemplateQuery = (staffId, orgId, locationId) => {
  const query = { staffId };
  if (orgId !== undefined) query.orgId = orgId || null;
  if (locationId !== undefined) query.locationId = locationId || null;
  return query;
};

const findActiveTemplate = async (staffId, orgId, locationId, date) => {
  const query = {
    ...buildTemplateQuery(staffId, orgId, locationId),
    validFrom: { $lte: date },
    $or: [{ validTo: null }, { validTo: { $gte: date } }],
  };
  const doc = await ScheduleTemplate.findOne(query);
  if (!doc) return null;
  return doc;
};

const findCurrentTemplate = async (staffId, orgId, locationId) => {
  const doc = await ScheduleTemplate.findOne({
    ...buildTemplateQuery(staffId, orgId, locationId),
    validTo: null,
  });
  return doc;
};

const createTemplate = async (data) => {
  const doc = await ScheduleTemplate.create(data);
  return await toScheduleTemplateDto(doc);
};

const updateTemplateValidTo = async (id, validTo) => {
  const doc = await ScheduleTemplate.findByIdAndUpdate(
    id,
    { validTo },
    { new: true },
  );
  return doc;
};

const findActiveTemplateDto = async (staffId, orgId, locationId, date) => {
  const doc = await findActiveTemplate(staffId, orgId, locationId, date);
  if (!doc) return null;
  return await toScheduleTemplateDto(doc);
};

const findActiveTemplatesByOrg = async (orgId, date) => {
  const memberships = await getActiveMembersByOrg(orgId)
  const userIds = memberships.map((m) => m.userId)

  const templates = await ScheduleTemplate.find({
    staffId: { $in: userIds },
    orgId: orgId,
    validFrom: { $lte: date },
    $or: [{ validTo: null }, { validTo: { $gte: date } }],
  }).lean()

  return Promise.all(templates.map(toScheduleTemplateDto))
}

export {
  findActiveTemplate,
  findActiveTemplateDto,
  findCurrentTemplate,
  createTemplate,
  updateTemplateValidTo,
  findActiveTemplatesByOrg,
};
