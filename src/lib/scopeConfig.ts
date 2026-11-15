/** Regions used by the tracker and its Nominatim place/diary search. */
export const SCOPE_CONFIG = {
  Austin: {
    label: 'Austin',
    center: [30.2672, -97.7431] as [number, number],
    zoom: 12,
    searchParams: '&viewbox=-98.3,30.7,-97.2,29.8&bounded=1'
  },
  Texas: {
    label: 'Texas',
    center: [31.0, -99.9018] as [number, number],
    zoom: 6,
    searchParams: '&viewbox=-106.65,36.5,-93.51,25.84&bounded=1'
  },
  USA: {
    label: 'USA',
    center: [37.0902, -95.7129] as [number, number],
    zoom: 4,
    // A viewbox is not sufficient for the whole USA. countrycodes is a hard
    // Nominatim filter that excludes results in other countries.
    searchParams: '&countrycodes=us'
  },
  'UK & Ireland': {
    label: 'UK & Ireland',
    center: [54.5, -4.5] as [number, number],
    zoom: 5,
    searchParams: '&viewbox=-11,61.2,2.2,49.8&bounded=1'
  }
};

export type ScopeName = keyof typeof SCOPE_CONFIG;
export const SCOPE_NAMES = Object.keys(SCOPE_CONFIG) as ScopeName[];

/** Shared by both Add Place and Diary search, so scope restrictions cannot drift. */
export function buildPlaceSearchUrl(query: string, scope: ScopeName): string {
  return `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}${SCOPE_CONFIG[scope].searchParams}`;
}
