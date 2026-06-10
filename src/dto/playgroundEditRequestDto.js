const toIsoOrNull = (value) => (value instanceof Date ? value.toISOString() : null);

const idToString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value.toString === 'function') return value.toString();
  return null;
};

const pickAuthorName = (authorRef) => {
  if (!authorRef || typeof authorRef !== 'object') return null;
  return authorRef.name ?? null;
};

const pickAuthorEmail = (authorRef) => {
  if (!authorRef || typeof authorRef !== 'object') return null;
  return authorRef.email ?? null;
};

const toAddressDiff = (address) => {
  if (!address || typeof address !== 'object') return undefined;
  const result = {};
  if (address.city !== undefined) result.city = address.city;
  if (address.district !== undefined) result.district = address.district;
  if (address.street !== undefined) result.street = address.street;
  if (address.fullAddress !== undefined) result.fullAddress = address.fullAddress;
  return Object.keys(result).length === 0 ? undefined : result;
};

const toDiffDTO = (diff) => {
  if (!diff || typeof diff !== 'object') return {};
  const result = {};
  if (diff.name !== undefined) result.name = diff.name;
  if (diff.description !== undefined) result.description = diff.description;
  const address = toAddressDiff(diff.address);
  if (address) result.address = address;
  if (diff.lat !== undefined && diff.lat !== null) result.lat = diff.lat;
  if (diff.lng !== undefined && diff.lng !== null) result.lng = diff.lng;
  return result;
};

/**
 * @param {import('mongoose').Document | object} doc
 * @returns {object | null}
 */
export function toDTO(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    playgroundId: idToString(doc.playgroundId),
    authorId: idToString(doc.authorId),
    authorName: pickAuthorName(doc.authorId),
    authorEmail: pickAuthorEmail(doc.authorId),
    diff: toDiffDTO(doc.diff),
    status: doc.status,
    createdAt: toIsoOrNull(doc.createdAt),
    resolvedAt: toIsoOrNull(doc.resolvedAt),
    resolvedBy: idToString(doc.resolvedBy),
  };
}
