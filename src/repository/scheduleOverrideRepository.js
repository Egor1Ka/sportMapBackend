import ScheduleOverride from "../models/ScheduleOverride.js";
import { toScheduleOverrideDto } from "../dto/scheduleDto.js";

const findOverrideByDate = async (staffId, orgId, locationId, date) => {
  const doc = await ScheduleOverride.findOne({
    staffId,
    orgId: orgId || null,
    locationId: locationId || null,
    date,
  });
  return doc;
};

const upsertOverride = async (data) => {
  const { staffId, orgId, locationId, date, ...rest } = data;
  const doc = await ScheduleOverride.findOneAndUpdate(
    {
      staffId,
      orgId: orgId || null,
      locationId: locationId || null,
      date,
    },
    { staffId, orgId: orgId || null, locationId: locationId || null, date, ...rest },
    { upsert: true, new: true },
  );
  return toScheduleOverrideDto(doc);
};

const findOverridesByStaff = async (staffId, orgId) => {
  const filter = { staffId };
  if (orgId !== undefined) filter.orgId = orgId;
  const docs = await ScheduleOverride.find(filter).sort({ date: 1 });
  return docs.map(toScheduleOverrideDto);
};

const deleteOverrideById = async (id) => {
  const doc = await ScheduleOverride.findByIdAndDelete(id);
  return doc;
};

const findOverridesByOrg = async (orgId) => {
  const docs = await ScheduleOverride.find({ orgId }).sort({ date: 1 });
  return docs.map(toScheduleOverrideDto);
};

export { findOverrideByDate, upsertOverride, findOverridesByStaff, deleteOverrideById, findOverridesByOrg };
