import { getUserById } from "../modules/user/index.js";
import { getMembershipByUserAndOrg } from "../repository/membershipRepository.js";
import { getPositionById } from "../repository/positionRepository.js";
import { getRawOrgById } from "../repository/organizationRepository.js";
import { toStaffDto } from "../dto/staffDto.js";

const buildOrgContactInfo = (org, membership) => ({
  orgName: org.name,
  orgLogo: org.settings ? org.settings.logoUrl || null : null,
  description: membership.bio || null,
  address: null,
  phone: null,
  website: null,
});

const buildUserContactInfo = (user) => ({
  orgName: null,
  orgLogo: null,
  description: user.description || null,
  address: user.address || null,
  phone: user.phone || null,
  website: user.website || null,
});

const getStaffProfile = async (id, orgId) => {
  const user = await getUserById(id);
  if (!user) return null;

  const membership = orgId
    ? await getMembershipByUserAndOrg(id, orgId)
    : null;

  const position = membership && membership.positionId
    ? await getPositionById(membership.positionId)
    : null;

  const staffDto = toStaffDto(user, position, membership);

  const org = membership ? await getRawOrgById(membership.orgId) : null;

  const contactInfo = org && membership
    ? buildOrgContactInfo(org, membership)
    : buildUserContactInfo(user);

  return { ...staffDto, ...contactInfo };
};

export { getStaffProfile };
