/**
 * Shared Nominatim search restrictions for both Add Place and Diary.
 *
 * The tracker scope is a hard limit, not just a map viewport preference.
 * Nominatim's countrycodes parameter prevents international matches before
 * ranking, and we check returned country codes again before displaying them.
 */
export type LocationSearchScope = 'Austin' | 'Texas' | 'USA' | 'UK & Ireland';

interface SearchRule {
  countryCodes: readonly string[];
  viewbox?: string;
}

const RULES: Record<LocationSearchScope, SearchRule> = {
  Austin: { countryCodes: ['us'], viewbox: '-98.3,30.7,-97.2,29.8' },
  Texas: { countryCodes: ['us'], viewbox: '-106.65,36.5,-93.51,25.84' },
  USA: { countryCodes: ['us'] },
  'UK & Ireland': { countryCodes: ['gb', 'ie'], viewbox: '-11,61.2,2.2,49.8' }
};

export interface NominatimLocation {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    country_code?: string;
    [field: string]: unknown;
  };
  [field: string]: unknown;
}

/** One-off coordinates supplied by the user in the Add Place dialog. */
export interface SearchPosition { lat: number; lng: number }

export function validSearchPosition(position: SearchPosition | null | undefined): position is SearchPosition {
  return !!position && Number.isFinite(position.lat) && Math.abs(position.lat) <= 90
    && Number.isFinite(position.lng) && Math.abs(position.lng) <= 180;
}

export function locationDistanceMiles(a: SearchPosition, b: SearchPosition): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function sortLocationsByDistance(results: NominatimLocation[], origin: SearchPosition | null): NominatimLocation[] {
  if (!validSearchPosition(origin)) return results;
  // Modern JS sort is stable; preserve Nominatim's order for equidistant matches.
  return [...results].sort((a, b) =>
    locationDistanceMiles(origin, { lat: Number(a.lat), lng: Number(a.lon) })
    - locationDistanceMiles(origin, { lat: Number(b.lat), lng: Number(b.lon) }));
}

export function locationSearchUrl(scope: LocationSearchScope, query: string, nearby?: SearchPosition | null): string {
  const rule = RULES[scope];
  const params = new URLSearchParams({
    format: 'json',
    q: query.trim(),
    addressdetails: '1',
    countrycodes: rule.countryCodes.join(','),
    limit: '20'
  });
  if (rule.viewbox) {
    // Keep Austin, Texas and UK/Ireland's existing hard geographic boundaries.
    params.set('viewbox', rule.viewbox);
    params.set('bounded', '1');
  } else if (validSearchPosition(nearby) && Math.abs(nearby.lat) < 85 && Math.abs(nearby.lng) < 179) {
    // USA covers the whole country; bias results towards an approximate nearby
    // area without excluding remote results, Alaska or Hawaii. Round to ~1 km
    // before sending the viewbox to the external geocoder.
    const lat = Math.round(nearby.lat * 100) / 100;
    const lng = Math.round(nearby.lng * 100) / 100;
    const box = [lng - 0.45, lat + 0.45, lng + 0.45, lat - 0.45].map(value => value.toFixed(2));
    params.set('viewbox', box.join(','));
  }
  return 'https://nominatim.openstreetmap.org/search?' + params.toString();
}

export function filterLocationResults(results: unknown, scope: LocationSearchScope): NominatimLocation[] {
  if (!Array.isArray(results)) return [];
  const allowed = RULES[scope].countryCodes;
  return results.filter((result): result is NominatimLocation => {
    if (!result || typeof result !== 'object') return false;
    const entry = result as Record<string, unknown>;
    const address = entry.address;
    if (!address || typeof address !== 'object') return false;
    const country = (address as Record<string, unknown>).country_code;
    const latitude = Number(entry.lat);
    const longitude = Number(entry.lon);
    return typeof entry.display_name === 'string'
      && typeof country === 'string'
      && allowed.includes(country.toLowerCase())
      && entry.lat !== undefined && entry.lon !== undefined
      && Number.isFinite(latitude) && Math.abs(latitude) <= 90
      && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  });
}

export async function searchLocations(
  scope: LocationSearchScope,
  query: string,
  request: typeof fetch = fetch,
  nearby?: SearchPosition | null
): Promise<NominatimLocation[]> {
  const response = await request(locationSearchUrl(scope, query, nearby));
  if (!response.ok) throw new Error('Location search failed');
  const results = filterLocationResults(await response.json(), scope);
  return validSearchPosition(nearby) ? sortLocationsByDistance(results, nearby) : results;
}
