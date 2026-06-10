import { getOgImageUrl, ASSET_TYPES } from "../modules/media/index.js";

const toString = (id) => id.toString();

/**
 * Каскад OG-картинки для staff:
 * - membership.avatar (per-org) → staff-avatar OG
 * - user.avatar (personal)      → user-avatar OG
 * - ничего → null (фронт подставит дефолт)
 */
const buildStaffOgImage = (user, membership) => {
  if (membership && membership.avatar) {
    return getOgImageUrl(
      ASSET_TYPES.STAFF_AVATAR,
      `${membership.orgId}/${user.id}`,
    );
  }
  if (user.avatar) {
    return getOgImageUrl(ASSET_TYPES.USER_AVATAR, user.id);
  }
  return null;
};

const toStaffDto = (user, position, membership) => ({
  id: user.id,
  name: (membership && membership.displayName) || user.name,
  displayName: membership ? membership.displayName || null : null,
  avatar: user.avatar,
  ogImage: buildStaffOgImage(user, membership),
  position: position ? position.name : null,
  bio: membership ? membership.bio || null : null,
  orgId: membership ? membership.orgId.toString() : null,
  locationIds: membership ? membership.locationIds.map(toString) : [],
});

const toOrgStaffDto = (user, position, bookingCount, status, membership) => ({
  id: user.id,
  name: (membership && membership.displayName) || user.name,
  displayName: membership ? membership.displayName || null : null,
  avatar: membership ? membership.avatar || "" : "",
  ogImage: buildStaffOgImage(user, membership),
  position: position ? position.name : null,
  positionId: membership && membership.positionId ? membership.positionId.toString() : null,
  bio: membership ? membership.bio || null : null,
  bookingCount,
  status: status || "active",
});

export { toStaffDto, toOrgStaffDto };
