import { getOgImageUrl, ASSET_TYPES } from "../modules/media/index.js";

const toOrgDto = (doc) => {
  const id = doc._id.toString();
  const hasLogo = Boolean(doc.settings && doc.settings.logoUrl);
  return {
    id,
    name: doc.name,
    timezone: doc.timezone || null,
    currency: doc.currency || "UAH",
    logo: doc.settings ? doc.settings.logoUrl || null : null,
    ogImage: hasLogo ? getOgImageUrl(ASSET_TYPES.ORG_LOGO, id) : null,
    description: doc.description || null,
    address: doc.address || null,
    phone: doc.phone || null,
    website: doc.website || null,
    active: doc.active !== false,
  };
};

const toOrgListItemDto = (org, membership) => ({
  id: org._id.toString(),
  name: org.name,
  logo: org.settings ? org.settings.logoUrl || null : null,
  role: membership.role,
  status: membership.status,
  active: org.active !== false,
});

export { toOrgDto, toOrgListItemDto };
