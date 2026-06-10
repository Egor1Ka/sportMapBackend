import { getOrgById, getRawOrgById, createOrg } from "../repository/organizationRepository.js";
import { getActiveMembersByOrg, getActiveAndInvitedMembersByOrg, getMembershipsByUser, createMembership, getMembershipByUserAndOrg, acceptInvitation as acceptInvitationRepo, declineInvitation as declineInvitationRepo } from "../repository/membershipRepository.js";
import { getUserById } from "../modules/user/index.js";
import { getPositionById } from "../repository/positionRepository.js";
import { countConfirmedBookings } from "../repository/bookingRepository.js";
import { toOrgStaffDto } from "../dto/staffDto.js";
import { toOrgDto, toOrgListItemDto } from "../dto/orgDto.js";
import { MEMBERSHIP_STATUS } from "../constants/booking.js";
import { createDefaultSchedule } from "./scheduleServices.js";
import { seedDefaultStatuses } from "./bookingStatusServices.js";
import Organization from "../models/Organization.js";
import Membership from "../models/Membership.js";
import { HttpError } from "../shared/utils/http/httpError.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";
import { getUserBillingProfile } from "../modules/billing/services/planServices.js";
import { parseWallClockToUtc, isValidTimezone } from "../shared/utils/timezone.js";

const getOrganizationById = async (id) => {
  return getOrgById(id);
};

const getDayRange = (dateStr, timezone) => {
  if (!timezone) throw new Error("timezone_required");
  const isoStart = `${dateStr}T00:00:00.000Z`;
  const isoEnd = `${dateStr}T23:59:59.999Z`;
  return {
    start: parseWallClockToUtc(isoStart, timezone),
    end: parseWallClockToUtc(isoEnd, timezone),
  };
};

const buildMemberProfile = async (member, dateRange) => {
  const user = await getUserById(member.userId.toString());
  if (!user) return null;

  const position = member.positionId
    ? await getPositionById(member.positionId)
    : null;

  const bookingCount = await countConfirmedBookings(
    member.userId,
    dateRange.start,
    dateRange.end,
  );

  return toOrgStaffDto(user, position, bookingCount, member.status, member);
};

const isNotNull = (item) => item !== null;

const toLocalDateStr = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getOrgStaff = async (id, dateStr) => {
  const org = await getOrgById(id);
  if (!org) return { error: "org_not_found" };

  if (!org.timezone) throw new Error("org_timezone_required");
  const timezone = org.timezone;
  const resolvedDateStr = dateStr || toLocalDateStr(new Date());

  const members = await getActiveAndInvitedMembersByOrg(org.id);
  const dateRange = getDayRange(resolvedDateStr, timezone);

  const toBuildProfile = (dateRange) => (member) => buildMemberProfile(member, dateRange);
  const profiles = await Promise.all(members.map(toBuildProfile(dateRange)));

  return { staff: profiles.filter(isNotNull) };
};

const createOrganization = async (data, userId) => {
  if (!data.timezone || !isValidTimezone(data.timezone)) {
    throw new Error("timezone_required");
  }

  const plan = await getUserBillingProfile(userId);
  const orgLimit = plan.limits.organizations || 0;

  const ownedOrgsCount = await Membership.countDocuments({
    userId,
    role: "owner",
  });

  if (ownedOrgsCount >= orgLimit) {
    throw new HttpError({ statusCode: 402, status: "limitReached" });
  }

  const orgData = {
    name: data.name,
    timezone: data.timezone,
    currency: data.currency || "UAH",
    settings: {
      defaultCountry: data.defaultCountry || "UA",
      brandColor: data.brandColor || undefined,
    },
  };

  const org = await createOrg(orgData);

  await createMembership({
    userId,
    orgId: org.id,
    role: "owner",
    status: MEMBERSHIP_STATUS.ACTIVE,
  });

  await createDefaultSchedule(userId, org.id).catch((err) =>
    console.error("[createDefaultSchedule] org creation failed:", err.message),
  );
  await seedDefaultStatuses(org.id, null).catch((err) =>
    console.error("[seedDefaultStatuses] org creation failed:", err.message),
  );

  return org;
};

const updateOrganization = async (orgId, data) => {
  const update = {};

  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description;
  if (data.address !== undefined) update.address = data.address;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.website !== undefined) update.website = data.website;
  if (data.brandColor !== undefined) update["settings.brandColor"] = data.brandColor;
  if (data.timezone !== undefined) update.timezone = data.timezone;
  if (data.currency !== undefined) update.currency = data.currency;

  if (Object.keys(update).length === 0) {
    throw new HttpError(generalStatus.BAD_REQUEST);
  }

  const org = await Organization.findByIdAndUpdate(orgId, update, { new: true });
  if (!org) {
    throw new HttpError(generalStatus.NOT_FOUND);
  }

  return toOrgDto(org);
};

/**
 * Обновить URL лого организации. Используется upload-/delete-эндпоинтами.
 * Возвращает обновлённый orgDto.
 */
const updateOrgLogo = async (orgId, url) => {
  const updated = await Organization.findByIdAndUpdate(
    orgId,
    { $set: { "settings.logoUrl": url } },
    { new: true },
  );
  if (!updated) return null;
  return toOrgDto(updated);
};

const updateStaffMember = async (orgId, staffId, updates) => {
  const changes = {};
  if (updates.bio !== undefined) {
    changes.bio = updates.bio && updates.bio.trim() ? updates.bio.trim() : null;
  }
  if (updates.displayName !== undefined) {
    const dn = updates.displayName && updates.displayName.trim();
    changes.displayName = dn ? dn : null;
  }

  if (Object.keys(changes).length === 0) {
    throw new HttpError(generalStatus.BAD_REQUEST);
  }

  const membership = await Membership.findOneAndUpdate(
    { userId: staffId, orgId, status: "active" },
    changes,
    { new: true },
  );

  if (!membership) {
    throw new HttpError(generalStatus.NOT_FOUND);
  }

  return {
    bio: membership.bio || null,
    displayName: membership.displayName || null,
  };
};

const updateStaffPosition = async (orgId, staffId, positionId) => {
  const membership = await Membership.findOneAndUpdate(
    { userId: staffId, orgId, status: "active" },
    { positionId: positionId || null },
    { new: true },
  );

  if (!membership) {
    throw new HttpError(generalStatus.NOT_FOUND);
  }

  return { positionId: membership.positionId ? membership.positionId.toString() : null };
};

const updateStaffAvatar = async (orgId, staffId, avatarUrl) => {
  const membership = await Membership.findOneAndUpdate(
    { userId: staffId, orgId, status: "active" },
    { avatar: avatarUrl || "" },
    { new: true },
  );

  if (!membership) {
    throw new HttpError(generalStatus.NOT_FOUND);
  }

  return { avatar: membership.avatar || "" };
};

const getUserOrganizations = async (userId) => {
  const memberships = await getMembershipsByUser(userId);
  const toOrgWithRole = async (membership) => {
    const org = await getRawOrgById(membership.orgId);
    if (!org) return null;
    return toOrgListItemDto(org, membership);
  };
  const orgs = await Promise.all(memberships.map(toOrgWithRole));
  return orgs.filter(isNotNull);
};

const addStaffToOrg = async (orgId, userId, invitedByUserId) => {
  const org = await getOrgById(orgId);
  if (!org) return { error: "org_not_found" };

  const user = await getUserById(userId);
  if (!user) return { error: "user_not_found" };

  const existing = await getMembershipByUserAndOrg(userId, orgId);
  if (existing) return { error: "already_member" };

  const membership = await createMembership({
    userId,
    orgId,
    role: "member",
    status: MEMBERSHIP_STATUS.INVITED,
    invitedBy: invitedByUserId,
  });

  return { staff: { id: user.id, name: user.name, avatar: user.avatar, position: null, bio: null, bookingCount: 0, status: "invited" } };
};

const acceptInvitation = async (orgId, userId) => {
  const result = await acceptInvitationRepo(userId, orgId);
  if (!result) return { error: "invitation_not_found" };

  await createDefaultSchedule(userId, orgId).catch((err) =>
    console.error("[createDefaultSchedule] accept invitation failed:", err.message),
  );

  return { success: true };
};

const declineInvitation = async (orgId, userId) => {
  const result = await declineInvitationRepo(userId, orgId);
  if (!result) return { error: "invitation_not_found" };
  return { success: true };
};

const getMyMembership = async (orgId, userId) => {
  const membership = await getMembershipByUserAndOrg(userId, orgId);
  if (!membership) return null;

  const position = membership.positionId
    ? await getPositionById(membership.positionId)
    : null;

  return {
    role: membership.role,
    status: membership.status,
    avatar: membership.avatar || "",
    displayName: membership.displayName || null,
    bio: membership.bio || null,
    positionId: membership.positionId ? membership.positionId.toString() : null,
    position: position ? position.name : null,
  };
};

export { getOrganizationById, getOrgStaff, createOrganization, updateOrganization, updateOrgLogo, updateStaffMember, updateStaffPosition, updateStaffAvatar, getUserOrganizations, addStaffToOrg, acceptInvitation, declineInvitation, getMyMembership, getDayRange };
