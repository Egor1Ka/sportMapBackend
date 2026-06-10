import { getOrganizationById, getOrgStaff, createOrganization, updateOrganization, updateOrgLogo, updateStaffMember, updateStaffPosition, updateStaffAvatar, getUserOrganizations, addStaffToOrg, acceptInvitation, declineInvitation, getMyMembership } from "../services/orgServices.js";
import { httpResponse, httpResponseError } from "../shared/utils/http/httpResponse.js";
import { generalStatus, userStatus } from "../shared/utils/http/httpStatus.js";
import { validateSchema } from "../shared/utils/validation/requestValidation.js";
import { isValidObjectId } from "../shared/utils/validation/validators.js";
import { isValidTimezone } from "../shared/utils/timezone.js";
import Membership from "../models/Membership.js";
import Organization from "../models/Organization.js";
import { uploadAvatar, deleteAvatar, ASSET_TYPES } from "../modules/media/index.js";

const createOrgSchema = {
  name: { type: "string", required: true },
  timezone: { type: "string", required: true },
  currency: { type: "string", required: false },
  brandColor: { type: "string", required: false },
  defaultCountry: { type: "string", required: false },
};

const updateOrgSchema = {
  name: { type: "string", required: false },
  description: { type: "string", required: false },
  address: { type: "string", required: false },
  phone: { type: "string", required: false },
  website: { type: "string", required: false },
  brandColor: { type: "string", required: false },
  timezone: { type: "string", required: false },
  currency: { type: "string", required: false },
};

const updateStaffMemberSchema = {
  bio: { type: "string", required: false },
  displayName: { type: "string", required: false },
};

const handleGetOrg = async (req, res) => {
  try {
    const org = await getOrganizationById(req.params.id);
    if (!org) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, org);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleGetOrgStaff = async (req, res) => {
  try {
    const result = await getOrgStaff(req.params.id, req.query.date);
    if (result.error === "org_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }

    return httpResponse(res, generalStatus.SUCCESS, result.staff);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleCreateOrg = async (req, res) => {
  try {
    const validated = validateSchema(createOrgSchema, req.body);
    if (validated.errors) {
      return httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: validated.errors,
      });
    }

    if (!isValidTimezone(validated.timezone)) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: { timezone: "invalid IANA timezone" } });
    }

    const org = await createOrganization(validated, req.user.id);
    return httpResponse(res, generalStatus.CREATED, org);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUpdateOrg = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const validated = validateSchema(updateOrgSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }
    if (validated.timezone !== undefined && !isValidTimezone(validated.timezone)) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: { timezone: "invalid IANA timezone" } });
    }
    if (validated.currency !== undefined && !["UAH", "USD"].includes(validated.currency)) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: { currency: "must be UAH or USD" } });
    }

    const result = await updateOrganization(req.params.id, validated);
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUpdateStaffMember = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    if (req.user.id !== req.params.staffId) {
      return httpResponse(res, generalStatus.UNAUTHORIZED);
    }

    const validated = validateSchema(updateStaffMemberSchema, req.body);
    if (validated.errors) {
      return httpResponse(res, generalStatus.BAD_REQUEST, { errors: validated.errors });
    }

    const displayName = validated.displayName;
    if (displayName !== undefined && displayName !== null && displayName !== "" && displayName.trim().length < 2) {
      return httpResponse(res, generalStatus.BAD_REQUEST, {
        errors: { displayName: "displayName - must be at least 2 characters or empty" },
      });
    }
    if (displayName !== undefined && displayName !== null && displayName.length > 100) {
      return httpResponse(res, generalStatus.BAD_REQUEST, {
        errors: { displayName: "displayName - must be at most 100 characters" },
      });
    }

    const updates = {};
    if (validated.bio !== undefined) updates.bio = validated.bio;
    if (validated.displayName !== undefined) updates.displayName = validated.displayName;

    const result = await updateStaffMember(req.params.id, req.params.staffId, updates);
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUpdateStaffPosition = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const { positionId } = req.body;
    if (positionId !== null && positionId !== undefined && !isValidObjectId(positionId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const result = await updateStaffPosition(req.params.id, req.params.staffId, positionId);
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleGetUserOrgs = async (req, res) => {
  try {
    const orgs = await getUserOrganizations(req.user.id);
    return httpResponse(res, generalStatus.SUCCESS, orgs);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const addStaffSchema = {
  userId: { type: "string", required: true },
};

const handleAddStaff = async (req, res) => {
  try {
    const validated = validateSchema(addStaffSchema, req.body);
    if (validated.errors) {
      return httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: validated.errors,
      });
    }

    const result = await addStaffToOrg(req.params.id, validated.userId, req.user.id);

    if (result.error === "org_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    if (result.error === "user_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    if (result.error === "already_member") {
      return httpResponseError(res, { statusCode: 409, status: "conflict", data: null });
    }

    return httpResponse(res, generalStatus.CREATED, result.staff);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleAcceptInvitation = async (req, res) => {
  try {
    const result = await acceptInvitation(req.params.id, req.user.id);
    if (result.error === "invitation_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeclineInvitation = async (req, res) => {
  try {
    const result = await declineInvitation(req.params.id, req.user.id);
    if (result.error === "invitation_not_found") {
      return httpResponse(res, generalStatus.NOT_FOUND);
    }
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleGetMyMembership = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const membership = await getMyMembership(req.params.id, req.user.id);
    if (!membership) return httpResponse(res, generalStatus.NOT_FOUND);

    return httpResponse(res, generalStatus.SUCCESS, membership);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const ADMIN_ROLES = ["owner", "admin"];

const canEditStaffAvatar = async (currentUserId, orgId, staffId) => {
  if (String(currentUserId) === String(staffId)) return true;
  const membership = await Membership.findOne({
    userId: currentUserId,
    orgId,
    status: "active",
  });
  return Boolean(membership && ADMIN_ROLES.includes(membership.role));
};

const handleUploadStaffAvatar = async (req, res) => {
  try {
    const { id: orgId, staffId } = req.params;

    if (!isValidObjectId(orgId) || !isValidObjectId(staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const allowed = await canEditStaffAvatar(req.user.id, orgId, staffId);
    if (!allowed) {
      return httpResponse(res, generalStatus.UNAUTHORIZED);
    }

    if (!req.file) {
      return httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: { file: { error: "File is required" } },
      });
    }

    const { url } = await uploadAvatar({
      assetType: ASSET_TYPES.STAFF_AVATAR,
      ownerId: `${orgId}/${staffId}`,
      file: req.file,
    });

    const result = await updateStaffAvatar(orgId, staffId, url);
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeleteStaffAvatar = async (req, res) => {
  try {
    const { id: orgId, staffId } = req.params;

    if (!isValidObjectId(orgId) || !isValidObjectId(staffId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const allowed = await canEditStaffAvatar(req.user.id, orgId, staffId);
    if (!allowed) {
      return httpResponse(res, generalStatus.UNAUTHORIZED);
    }

    const current = await Membership.findOne({ userId: staffId, orgId, status: "active" });
    if (current && current.avatar) {
      await deleteAvatar({
        assetType: ASSET_TYPES.STAFF_AVATAR,
        ownerId: `${orgId}/${staffId}`,
      });
    }

    const result = await updateStaffAvatar(orgId, staffId, "");
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleUploadOrgLogo = async (req, res) => {
  try {
    const { id: orgId } = req.params;
    if (!isValidObjectId(orgId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }
    if (!req.file) {
      return httpResponseError(res, {
        ...userStatus.VALIDATION_ERROR,
        data: { file: { error: "File is required" } },
      });
    }

    const { url } = await uploadAvatar({
      assetType: ASSET_TYPES.ORG_LOGO,
      ownerId: orgId,
      file: req.file,
    });

    const result = await updateOrgLogo(orgId, url);
    if (!result) return httpResponse(res, generalStatus.NOT_FOUND);
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

const handleDeleteOrgLogo = async (req, res) => {
  try {
    const { id: orgId } = req.params;
    if (!isValidObjectId(orgId)) {
      return httpResponse(res, generalStatus.BAD_REQUEST);
    }

    const current = await Organization.findById(orgId);
    if (!current) return httpResponse(res, generalStatus.NOT_FOUND);

    if (current.settings && current.settings.logoUrl) {
      await deleteAvatar({
        assetType: ASSET_TYPES.ORG_LOGO,
        ownerId: orgId,
      });
    }

    const result = await updateOrgLogo(orgId, "");
    return httpResponse(res, generalStatus.SUCCESS, result);
  } catch (error) {
    return httpResponseError(res, error);
  }
};

export { handleGetOrg, handleGetOrgStaff, handleCreateOrg, handleUpdateOrg, handleUpdateStaffMember, handleUpdateStaffPosition, handleGetUserOrgs, handleAddStaff, handleAcceptInvitation, handleDeclineInvitation, handleGetMyMembership, handleUploadStaffAvatar, handleDeleteStaffAvatar, handleUploadOrgLogo, handleDeleteOrgLogo };
