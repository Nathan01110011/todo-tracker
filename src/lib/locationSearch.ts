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

export function locationSearchUrl(scope: LocationSearchScope, query: string): string {
  const rule = RULES[scope];
  const params = new URLSearchParams({
    format: 'json',
    q: query.trim(),
    addressdetails: '1',
    countrycodes: rule.countryCodes.join(','),
    limit: '20'
  });
  if (rule.viewbox) {
    params.set('viewbox', rule.viewbox);
    params.set('bounded', '1');
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
  request: typeof fetch = fetch
): Promise<NominatimLocation[]> {
  const response = await request(locationSearchUrl(scope, query));
  if (!response.ok) throw new Error('Location search failed');
  return filterLocationResults(await response.json(), scope);
}
