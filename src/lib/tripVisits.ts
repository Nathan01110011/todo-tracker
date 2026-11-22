/** Trip timeline reconciliation: share the same matching rules between the API and UI.
 * Never treat an upload timestamp as proof of a visit.
 */
export type VisitPlaceType = 'place' | 'hotel';
export interface TripVisitPlace {
  id: string;
  type: VisitPlaceType;
  scope: string;
  status: string;
  date?: string;
  photoDetails?: Array<{ capturedAt?: string }>;
}
export interface TripVisitDiary {
  placeId: string;
  placeType: string;
  date: string;
  scope: string;
}
export interface TripDateWindow {
  scope: string;
  startDate?: string;
  endDate?: string;
}

export function normalizeTripStop(id: string): string {
  return id.includes(':') ? id : 'place:' + id;
}

export function validTripDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function capturedTripDay(value?: string): string {
  const match = (value || '').match(/^(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T]|$)/);
  if (!match) return '';
  const date = match[1] + '-' + match[2] + '-' + match[3];
  return validTripDay(date) ? date : '';
}

export function tripVisitDates(
  route: TripDateWindow,
  locations: TripVisitPlace[],
  diary: TripVisitDiary[],
  today: string
): Record<string, string> {
  const start = route.startDate || '';
  const end = route.endDate || start;
  if (!validTripDay(start) || !validTripDay(end) || end < start) return {};
  // A date-scoped trip must not infer visits from future appointments.
  const latest = validTripDay(today) ? today : end;
  const dates: Record<string, string> = {};
  const within = (day: string) => validTripDay(day) && day >= start && day <= end && day <= latest;
  const seenIds = new Map<string, Set<VisitPlaceType>>();
  for (const p of locations) {
    if (!seenIds.has(p.id)) seenIds.set(p.id, new Set());
    seenIds.get(p.id)!.add(p.type);
  }
  const add = (stop: string, day: string) => {
    if (within(day) && (!dates[stop] || day < dates[stop])) dates[stop] = day;
  };
  const inScope = locations.filter(p => p.scope === route.scope && !!p.id);
  const allowed = new Set(inScope.map(p => p.type + ':' + p.id));
  for (const place of inScope) {
    const stop = place.type + ':' + place.id;
    if (place.status === 'Visited') add(stop, place.date || '');
    // Legacy Photos rows are keyed only by place ID, not type. When a hotel
    // and place share the same ID, only typed diary links are unambiguous.
    if (seenIds.get(place.id)?.size === 1) {
      for (const photo of place.photoDetails || []) add(stop, capturedTripDay(photo.capturedAt));
    }
  }
  for (const entry of diary) {
    if (entry.scope !== route.scope || !entry.placeId) continue;
    const type = entry.placeType || 'place'; // compatibility with old diary records
    if (type !== 'place' && type !== 'hotel') continue;
    const stop = type + ':' + entry.placeId;
    if (allowed.has(stop)) add(stop, entry.date);
  }
  return dates;
}

export interface TripTimeline {
  placeIds: string[];
  completedPlaceIds: string[];
}
export function reconcileTripTimeline(
  current: TripTimeline,
  visits: Record<string, string>
): TripTimeline & { addedIds: string[]; newlyCompletedIds: string[] } {
  const placeIds = [...current.placeIds];
  const completedPlaceIds = [...current.completedPlaceIds];
  const known = new Set(placeIds.map(normalizeTripStop));
  const completed = new Set(completedPlaceIds.map(normalizeTripStop));
  const addedIds: string[] = [];
  const newlyCompletedIds: string[] = [];
  // Stable ordering for same-day visits: existing order first, new stops in
  // alphabetical ID order. Display applies chronological ordering separately.
  const ordered = Object.keys(visits).sort((a, b) => visits[a].localeCompare(visits[b]) || a.localeCompare(b));
  for (const stop of ordered) {
    if (!known.has(stop)) {
      placeIds.push(stop);
      known.add(stop);
      addedIds.push(stop);
    }
    if (!completed.has(stop)) {
      completedPlaceIds.push(stop);
      completed.add(stop);
      newlyCompletedIds.push(stop);
    }
  }
  return { placeIds, completedPlaceIds, addedIds, newlyCompletedIds };
}

export function orderTripStops(
  placeIds: string[],
  completedPlaceIds: string[],
  visits: Record<string, string>
): string[] {
  const completed = new Set(completedPlaceIds.map(normalizeTripStop));
  const numbered = placeIds.map((id, index) => ({ id, stop: normalizeTripStop(id), index }));
  const visited = numbered.filter(p => completed.has(p.stop)).sort((a, b) => {
    const left = visits[a.stop] || '';
    const right = visits[b.stop] || '';
    if (!left && !right) return a.index - b.index;
    if (!left) return 1;
    if (!right) return -1;
    return left.localeCompare(right) || a.index - b.index;
  });
  return [...visited, ...numbered.filter(p => !completed.has(p.stop))].map(p => p.id);
}
