/**
 * Source of truth for super-admin detection.
 *
 * ENV variable: ADMIN_IDS = comma-separated user MongoDB ids.
 * If a user's id is present in the list — they are super-admin.
 */

const parseAdminIds = () => {
  const raw = process.env.ADMIN_IDS;
  if (!raw || typeof raw !== 'string') return new Set();
  const ids = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return new Set(ids);
};

/**
 * @param {{ id?: string } | undefined | null} user
 * @returns {boolean}
 */
export function isAdmin(user) {
  if (!user || !user.id) return false;
  return parseAdminIds().has(String(user.id));
}
