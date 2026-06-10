const isPopulatedSport = (value) =>
  value && typeof value === 'object' && '_id' in value && 'code' in value;

const toSportSummary = (value) => {
  if (!isPopulatedSport(value)) return null;
  return {
    id: value._id.toString(),
    code: value.code,
    label: value.label ?? value.code,
    icon: value.icon ?? null,
    color: value.color ?? null,
  };
};

const toSportsList = (sports) => {
  if (!Array.isArray(sports)) return [];
  return sports.map(toSportSummary).filter((sport) => sport !== null);
};

const toAddressDTO = (address) => {
  if (!address) {
    return { city: null, district: null, street: null, fullAddress: null };
  }
  return {
    city: address.city ?? null,
    district: address.district ?? null,
    street: address.street ?? null,
    fullAddress: address.fullAddress ?? null,
  };
};

const toCoords = (location) => {
  if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    return { lng: null, lat: null };
  }
  const [lng, lat] = location.coordinates;
  return { lng, lat };
};

const emptyCounters = () => ({ activeCheckIns: 0, upcomingEvents: 0 });

const emptyRating = () => ({ average: null, count: 0 });

const idToString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value.toString === 'function') return value.toString();
  return null;
};

/**
 * @param {import('mongoose').Document} doc
 * @param {{ counters?: { activeCheckIns: number, upcomingEvents: number }, rating?: { average: number | null, count: number }, viewer?: { isCheckedInHere: boolean, isOwner: boolean } | null }} [extras]
 */
export function toDTO(doc, extras = {}) {
  if (!doc) return null;
  const { lng, lat } = toCoords(doc.location);
  const result = {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description ?? null,
    lat,
    lng,
    address: toAddressDTO(doc.address),
    sports: toSportsList(doc.sports),
    photos: Array.isArray(doc.photos) ? doc.photos : [],
    counters: extras.counters ?? emptyCounters(),
    rating: extras.rating ?? emptyRating(),
    createdBy: idToString(doc.createdBy),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : null,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
  };
  if (extras.viewer) {
    result.viewer = extras.viewer;
  }
  return result;
}
