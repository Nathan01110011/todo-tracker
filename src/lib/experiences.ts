export const interests = ['Interested', 'Favourite', 'Maybe', 'Not interested'] as const;
export const offeringStatuses = ['Want to try', 'Tried', 'Would repeat'] as const;
export const sessionStatuses = ['Interested', 'Booked', 'Attended', 'Missed', 'Cancelled', 'Past'] as const;
export const experienceCategories = ['Food & cooking', 'Wine & drinks', 'Arts & crafts', 'Outdoors & adventure', 'Music & dance', 'Culture & comedy', 'Fitness & sport'];
export interface Organiser {
  id: string; name: string; website: string; location: string; area: string;
  lat: number | null; lng: number | null; categories: string[];
  interest: typeof interests[number]; notes: string; sourceUrl: string;
}
export interface Offering {
  id: string; organiserId: string; title: string; category: string; description: string;
  priceMin: number | null; priceMax: number | null; status: typeof offeringStatuses[number];
  completionCount: number; lastCompletedDate: string;
}
export interface Session {
  id: string; offeringId: string; title: string; start: string; end: string; price: number | null;
  bookingUrl: string; status: typeof sessionStatuses[number]; lastVerifiedAt: string; notes: string; diaryEntryId: string;
}
export interface Experiences { organisers: Organiser[]; offerings: Offering[]; sessions: Session[] }
export const emptyExperiences = (): Experiences => ({ organisers: [], offerings: [], sessions: [] });
export type ExperienceKind = keyof Experiences;
export type ExperienceRecord = Organiser | Offering | Session;
export const austinToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export const isPastSession = (s: Session, now = new Date()) => {
  const value = s.end || s.start;
  return Boolean(value && (value.length === 10 ? value < austinToday(now) : Date.parse(value) < now.getTime()));
};
export const sessionDisplayStatus = (s: Session, now = new Date()) => s.status === 'Interested' && isPastSession(s, now) ? 'Past' : s.status;
export const isUpcomingSession = (s: Session, now = new Date()) => Boolean(s.start) && !isPastSession(s, now) && ['Interested', 'Booked'].includes(s.status);
export const priceLabel = (min: number | null, max: number | null = min) => min === null && max === null ? 'Price to check' : min === 0 && (max === 0 || max === null) ? 'Free' : min === null ? `Up to $${max}` : max === null || min === max ? `$${min}` : `$${min}–$${max}`;
export const safeUrl = (value: string) => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
export function distanceMiles(a: { lat: number; lng: number }, b: Organiser) {
  if (b.lat === null || b.lng === null) return null;
  const rad = Math.PI / 180;
  const d = Math.sin((b.lat-a.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((b.lng-a.lng)*rad/2)**2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(d), Math.sqrt(1-d));
}
export interface ExperienceFilters { search: string; category: string; area: string; interest: string; maxPrice: string; upcoming: boolean; completed: boolean; radius: string; origin: { lat: number; lng: number } | null }
export function filterExperiences(data: Experiences, f: ExperienceFilters, now = new Date()) {
  return data.organisers.flatMap(organiser => {
    const miles = f.origin ? distanceMiles(f.origin, organiser) : null;
    if (f.area && organiser.area !== f.area || f.interest && organiser.interest !== f.interest || f.radius && (miles === null || miles > Number(f.radius))) return [];
    const parentMatches = `${organiser.name} ${organiser.location} ${organiser.notes}`.toLowerCase().includes(f.search.toLowerCase().trim());
    const offerings = data.offerings.filter(o => o.organiserId === organiser.id).filter(o => {
      const sessions = data.sessions.filter(s => s.offeringId === o.id);
      return (!f.category || o.category === f.category)
        && (!f.search.trim() || parentMatches || `${o.title} ${o.description} ${sessions.map(s => `${s.title} ${s.notes}`).join(' ')}`.toLowerCase().includes(f.search.toLowerCase().trim()))
        && (!f.completed || o.completionCount > 0)
        && (!f.upcoming || sessions.some(s => isUpcomingSession(s, now)))
        && (!f.maxPrice || ((o.priceMin ?? o.priceMax) !== null && (o.priceMin ?? o.priceMax)! <= Number(f.maxPrice)) || sessions.some(s => s.price !== null && s.price <= Number(f.maxPrice) && (!f.upcoming || isUpcomingSession(s, now))));
    });
    const offeringFilter = Boolean(f.category || f.maxPrice || f.upcoming || f.completed);
    return offerings.length || (!offeringFilter && (!f.search.trim() || parentMatches)) ? [{ organiser, offerings, miles }] : [];
  }).sort((a,b) => a.organiser.name.localeCompare(b.organiser.name));
}

// Convert optional wall-clock times to an explicit Austin instant, including DST.
export function austinTimestamp(date: string, time: string) {
  if (!date || !time) return date;
  const wallClock = Date.parse(`${date}T${time}:00Z`);
  let instant = wallClock;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'shortOffset' }).formatToParts(new Date(instant));
    const match = parts.find(p => p.type === 'timeZoneName')!.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    const offset = match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0;
    instant = wallClock - offset * 60000;
  }
  const parts = austinDateParts(new Date(instant).toISOString());
  if (parts.date !== date || parts.time !== time) throw new Error('That time does not exist in Austin because the clocks change. Choose another time.');
  return new Date(instant).toISOString();
}
export function austinDateParts(value: string) {
  if (!value || value.length === 10) return { date:value, time:'' };
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Chicago', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return { date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}` };
}
