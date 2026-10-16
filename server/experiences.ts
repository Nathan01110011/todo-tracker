import { randomUUID } from 'node:crypto';
import type { GoogleSpreadsheet } from 'google-spreadsheet';
import { austinToday, emptyExperiences, interests, offeringStatuses, safeUrl, sessionStatuses, type ExperienceKind, type ExperienceRecord, type Experiences, type Offering, type Organiser, type Session } from '../src/lib/experiences';
import { experienceSeeds } from '../src/lib/experienceSeeds';

const sheets: Record<ExperienceKind, string> = { organisers: 'ExperienceOrganisers', offerings: 'ExperienceOfferings', sessions: 'ExperienceSessions' };
export class ExperienceError extends Error { constructor(message: string, public status = 400) { super(message); } }
function assert(test: unknown, message: string): asserts test { if (!test) throw new ExperienceError(message); }
export async function readExperiences(doc: GoogleSpreadsheet): Promise<Experiences> {
  const data = emptyExperiences();
  await Promise.all((Object.keys(sheets) as ExperienceKind[]).map(async kind => {
    const sheet = doc.sheetsByTitle[sheets[kind]];
    if (!sheet) return;
    const rows = await sheet.getRows();
    for (const row of rows) {
      // Fail visibly on corrupt data; never replace a damaged collection with an empty one.
      const record = JSON.parse(String(row.get('data')));
      if (!record || record.id !== row.get('id')) throw new Error(`Invalid record in ${sheets[kind]}`);
      (data[kind] as ExperienceRecord[]).push(record);
    }
  }));
  return data;
}
export function validateRecord(kind: ExperienceKind, input: Record<string, unknown>, data: Experiences): ExperienceRecord {
  const str = (key: string, required = false) => { const value = String(input[key] ?? '').trim(); assert(value.length <= 6000, `${key} is too long.`); assert(!required || value, `${key} is required.`); return value; };
  const url = (key: string) => { const value = str(key); assert(!value || safeUrl(value), `${key} must be an http or https URL.`); return value; };
  const num = (key: string, min = 0, max = 1000000) => { const raw = input[key]; if (raw === '' || raw === null || raw === undefined) return null; const value = Number(raw); assert(Number.isFinite(value) && value >= min && value <= max, `${key} must be between ${min} and ${max}.`); return value; };
  const choice = <T extends string>(key: string, choices: readonly T[]): T => { const v = str(key); assert(choices.includes(v as T), `Invalid ${key}.`); return v as T; };
  const date = (key: string, dateOnly = false) => {
    const v = str(key);
    assert(!v || (/^\d{4}-\d{2}-\d{2}$/.test(v) || !dateOnly && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) && Number.isFinite(Date.parse(v)) && new Date(`${v.slice(0,10)}T12:00:00Z`).toISOString().slice(0,10) === v.slice(0,10), `Invalid ${key}; timed sessions need a timezone offset.`);
    return v;
  };
  const id = str('id', true);
  assert(/^[a-zA-Z0-9-]{1,120}$/.test(id), 'Invalid ID.');
  if (kind === 'organisers') {
    const lat = num('lat', -90, 90), lng = num('lng', -180, 180);
    assert((lat === null) === (lng === null), 'Set both latitude and longitude, or leave both blank.');
    assert(Array.isArray(input.categories) && input.categories.every(v => typeof v === 'string' && v.length < 100) && input.categories.length <= 30, 'Invalid categories.');
    return { id, name: str('name', true), website: url('website'), location: str('location'), area: str('area'), lat, lng, categories: input.categories as string[], interest: choice('interest', interests), notes: str('notes'), sourceUrl: url('sourceUrl') };
  }
  if (kind === 'offerings') {
    const organiserId = str('organiserId', true);
    assert(data.organisers.some(o => o.id === organiserId), 'Organiser not found.');
    const priceMin = num('priceMin'), priceMax = num('priceMax');
    assert(priceMin === null || priceMax === null || priceMax >= priceMin, 'Maximum price must be at least the minimum.');
    const completionCount = num('completionCount') ?? 0, lastCompletedDate = date('lastCompletedDate', true);
    assert(Number.isInteger(completionCount), 'Completion count must be a whole number.');
    assert(!lastCompletedDate || lastCompletedDate <= austinToday(), 'Completion date cannot be in the future.');
    assert(completionCount > 0 ? Boolean(lastCompletedDate) : !lastCompletedDate, 'Completion count and last completed date must agree.');
    const status = choice('status', offeringStatuses);
    assert(completionCount > 0 ? status !== 'Want to try' : status === 'Want to try', 'Tried and Would repeat need a completion; Want to try needs zero completions.');
    return { id, organiserId, title: str('title', true), category: str('category', true), description: str('description'), priceMin, priceMax, status, completionCount, lastCompletedDate };
  }
  const offeringId = str('offeringId', true);
  assert(data.offerings.some(o => o.id === offeringId), 'Offering not found.');
  const start = date('start'), end = date('end');
  assert(!end || start && (start.length === 10) === (end.length === 10) && Date.parse(end) >= Date.parse(start), 'End must follow start, using the same date/time format.');
  return { id, offeringId, title: str('title'), start, end, price: num('price'), bookingUrl: url('bookingUrl'), status: choice('status', sessionStatuses), lastVerifiedAt: date('lastVerifiedAt'), notes: str('notes'), diaryEntryId: str('diaryEntryId') };
}
async function putRecord(doc: GoogleSpreadsheet, kind: ExperienceKind, record: ExperienceRecord) {
  let sheet = doc.sheetsByTitle[sheets[kind]];
  if (!sheet) sheet = await doc.addSheet({ title: sheets[kind], headerValues: ['id', 'data'] });
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === record.id);
  // JSON is a single cell so user-supplied text is never interpreted as a spreadsheet formula.
  if (row) { row.set('data', JSON.stringify(record)); await row.save(); }
  else await sheet.addRow({ id: record.id, data: JSON.stringify(record) });
}
export async function mutateExperiences(doc: GoogleSpreadsheet, body: Record<string, any>) {
  const data = await readExperiences(doc);
  if (body.action === 'import') {
    const seeds = experienceSeeds();
    let imported = 0;
    for (const kind of Object.keys(sheets) as ExperienceKind[]) {
      const existing = new Set(data[kind].map(r => r.id));
      const missing = (seeds[kind] as ExperienceRecord[]).filter(record => !existing.has(record.id));
      if (!missing.length) continue;
      let sheet = doc.sheetsByTitle[sheets[kind]];
      if (!sheet) sheet = await doc.addSheet({ title: sheets[kind], headerValues: ['id', 'data'] });
      await sheet.addRows(missing.map(record => ({ id: record.id, data: JSON.stringify(record) })));
      (data[kind] as ExperienceRecord[]).push(...missing);
      imported += missing.length;
    }
    return { success: true, imported, experiences: data };
  }
  const kind = body.kind as ExperienceKind;
  assert(Object.hasOwn(sheets, kind), 'Invalid experience kind.');
  const records = data[kind] as ExperienceRecord[];
  const existing = records.find(r => r.id === body.record?.id);
  if (body.action === 'delete') {
    if (!existing) throw new ExperienceError('Record not found.', 404);
    assert(!(kind === 'organisers' && data.offerings.some(o => o.organiserId === existing.id)) && !(kind === 'offerings' && data.sessions.some(s => s.offeringId === existing.id)), 'Remove child records first.');
    const rows = await doc.sheetsByTitle[sheets[kind]].getRows();
    await rows.find(r => r.get('id') === existing.id)!.delete();
    (data[kind] as ExperienceRecord[]) = records.filter(r => r.id !== existing.id);
    return { success: true, experiences: data };
  }
  assert(body.action === 'save' || body.action === 'linkDiary', 'Unsupported experience action.');
  let record = validateRecord(kind, { ...existing, ...body.record, id: body.record?.id || randomUUID() }, data);
  if (existing) {
    assert(kind !== 'offerings' || (record as Offering).organiserId === (existing as Offering).organiserId, 'An offering cannot change organiser.');
    assert(kind !== 'sessions' || (record as Session).offeringId === (existing as Session).offeringId, 'A session cannot change offering.');
  }
  if (kind === 'sessions') {
    const session = record as Session;
    assert(body.action === 'linkDiary' || session.diaryEntryId === ((existing as Session | undefined)?.diaryEntryId || ''), 'Use Link Diary to attach an entry.');
    if (body.action === 'linkDiary') {
      assert(existing && session.status === 'Attended', 'Only a saved attended session can link to Diary.');
      const diaryId = String(body.diaryEntryId || '');
      const diarySheet = doc.sheetsByTitle['Diary'];
      const rows = diarySheet ? await diarySheet.getRows() : [];
      assert(!diaryId || rows.some(r => r.get('id') === diaryId), 'Diary entry not found.');
      record = { ...session, diaryEntryId: diaryId };
    }
  } else assert(body.action !== 'linkDiary', 'Only sessions link to Diary.');
  await putRecord(doc, kind, record);
  const index = records.findIndex(r => r.id === record.id);
  if (index < 0) records.push(record); else records[index] = record;
  return { success: true, id: record.id, experiences: data };
}
