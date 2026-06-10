const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = process.env.GEOCODER_USER_AGENT ?? 'sportmap-backend/1.0 (egorzozulia@gmail.com)';
const ACCEPT_LANGUAGE = 'uk,ru,en';
const REQUEST_TIMEOUT_MS = 8000;

const buildUrl = (lat, lng) => {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    'accept-language': ACCEPT_LANGUAGE,
    addressdetails: '1',
    zoom: '18',
  });
  return `${NOMINATIM_BASE}?${params.toString()}`;
};

const pickCity = (address) =>
  address?.city ?? address?.town ?? address?.village ?? address?.hamlet ?? null;

const pickDistrict = (address) =>
  address?.suburb ?? address?.city_district ?? address?.neighbourhood ?? address?.district ?? null;

const pickStreet = (address) => address?.road ?? address?.pedestrian ?? null;

const toAddressShape = (data) => {
  const address = data?.address ?? {};
  return {
    city: pickCity(address),
    district: pickDistrict(address),
    street: pickStreet(address),
    fullAddress: data?.display_name ?? null,
  };
};

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': ACCEPT_LANGUAGE },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Reverse geocode coordinates via OpenStreetMap Nominatim.
 * Returns null on failure (geocoding is best-effort, not blocking).
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ city: string|null, district: string|null, street: string|null, fullAddress: string|null } | null>}
 */
export async function reverseGeocode(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  try {
    const response = await fetchWithTimeout(buildUrl(lat, lng));
    if (!response.ok) return null;
    const data = await response.json();
    return toAddressShape(data);
  } catch {
    return null;
  }
}
