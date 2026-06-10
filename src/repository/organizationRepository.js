import Organization from "../models/Organization.js";
import { toOrgDto, toOrgListItemDto } from "../dto/orgDto.js";

const getOrgById = async (id) => {
  const doc = await Organization.findById(id);
  if (!doc) return null;
  return toOrgDto(doc);
};

const getRawOrgById = async (id) => {
  return Organization.findById(id);
};

const createOrg = async (data) => {
  const doc = await Organization.create(data);
  return toOrgDto(doc);
};

export { getOrgById, getRawOrgById, createOrg };
