import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDoc } from './fakeSheets';
import { mutateExperiences, readExperiences, validateRecord } from '../server/experiences';
import { austinToday, austinTimestamp, austinDateParts, emptyExperiences, filterExperiences, isUpcomingSession, priceLabel, sessionDisplayStatus, type ExperienceFilters, type Session } from '../src/lib/experiences';
import { experienceSeeds } from '../src/lib/experienceSeeds';

const doc = () => new FakeDoc() as any;
const filter: ExperienceFilters = { search:'', category:'', area:'', interest:'', maxPrice:'', upcoming:false, completed:false, radius:'', origin:null };
const now = new Date('2026-10-15T21:00:00Z');

test('seed import creates all three levels, is repeatable and preserves user changes', async () => {
  const db = doc();
  const first = await mutateExperiences(db, { action:'import' });
  assert.equal(first.experiences.organisers.length,24);
  assert.equal(first.experiences.sessions.length,15);
  const changed = { ...first.experiences.organisers[0], interest:'Favourite', notes:'My notes' };
  await mutateExperiences(db, { action:'save', kind:'organisers', record:changed });
  const again = await mutateExperiences(db, { action:'import' });
  assert.equal(again.imported,0);
  assert.equal(again.experiences.organisers[0].notes,'My notes');
  assert.equal(new Set(again.experiences.offerings.map(o => o.id)).size,again.experiences.offerings.length);
  for (const kind of ['organisers','offerings','sessions'] as const) {
    for (const record of experienceSeeds()[kind]) assert.doesNotThrow(() => validateRecord(kind,record as any,first.experiences));
  }
});

test('partial imports resume and no parent/child rows are overwritten', async () => {
  const db = doc();
  const seeds = experienceSeeds();
  await mutateExperiences(db, { action:'save', kind:'organisers', record:seeds.organisers[0] });
  const result = await mutateExperiences(db, { action:'import' });
  assert.equal(result.imported, seeds.organisers.length+seeds.offerings.length+seeds.sessions.length-1);
});

test('missed, cancelled and past sessions never remove or complete parents; repeated occurrences persist', async () => {
  const db = doc();
  const { experiences } = await mutateExperiences(db, { action:'import' });
  const session = experiences.sessions[0];
  for (const status of ['Missed','Cancelled','Past','Attended']) await mutateExperiences(db, { action:'save', kind:'sessions', record:{ ...session, status } });
  await mutateExperiences(db, { action:'save', kind:'sessions', record:{ ...session, id:undefined, start:'2027-11-12', end:'' } });
  const reread = await readExperiences(db);
  assert.equal(reread.organisers.length,24);
  assert.equal(reread.offerings.find(o => o.id === session.offeringId)?.completionCount,0);
  assert.equal(reread.sessions.filter(s => s.offeringId === session.offeringId).length,2);
  assert.equal(filterExperiences(reread,filter,now).length,24);
});

test('offering completion and undated offerings persist independently of attendance', async () => {
  const db = doc();
  const { experiences } = await mutateExperiences(db, { action:'import' });
  const offering = experiences.offerings[0];
  await mutateExperiences(db, { action:'save', kind:'offerings', record:{ ...offering, status:'Would repeat', completionCount:2, lastCompletedDate:austinToday() } });
  const reread = await readExperiences(db);
  assert.equal(reread.offerings[0].completionCount,2);
  assert.equal(reread.sessions[0].status,'Interested');
  assert.equal(filterExperiences(reread,{ ...filter, completed:true },now).length,1);
  assert.ok(reread.offerings.some(o => !reread.sessions.some(s => s.offeringId === o.id)));
});

test('Diary linking requires an existing attended session and a valid Diary entry; links can be cleared', async () => {
  const db = doc();
  const { experiences } = await mutateExperiences(db, { action:'import' });
  const session = experiences.sessions[0];
  await assert.rejects(mutateExperiences(db,{ action:'linkDiary',kind:'sessions',record:session,diaryEntryId:'missing' }), /attended/);
  await mutateExperiences(db,{ action:'save',kind:'sessions',record:{ ...session,status:'Attended' } });
  await assert.rejects(mutateExperiences(db,{ action:'linkDiary',kind:'sessions',record:{ id:session.id },diaryEntryId:'missing' }), /not found/);
  const diary = await db.addSheet({ title:'Diary',headerValues:['id'] }); await diary.addRow({ id:'diary-1' });
  await mutateExperiences(db,{ action:'linkDiary',kind:'sessions',record:{ id:session.id },diaryEntryId:'diary-1' });
  assert.equal((await readExperiences(db)).sessions[0].diaryEntryId,'diary-1');
  await mutateExperiences(db,{ action:'linkDiary',kind:'sessions',record:{ id:session.id },diaryEntryId:'' });
  assert.equal((await readExperiences(db)).sessions[0].diaryEntryId,'');
});

test('invalid data is rejected and parent deletion cannot orphan records', async () => {
  const db = doc();
  const { experiences } = await mutateExperiences(db, { action:'import' });
  const o = experiences.offerings[0], v = experiences.organisers[0], s = experiences.sessions[0];
  await assert.rejects(mutateExperiences(db,{ action:'delete',kind:'organisers',record:v }), /child/);
  await assert.rejects(mutateExperiences(db,{ action:'delete',kind:'offerings',record:o }), /child/);
  for (const record of [{ ...v,website:'javascript:alert(1)' }, { ...v,lat:100,lng:1 }, { ...v,lat:1,lng:null }]) assert.throws(() => validateRecord('organisers',record,experiences));
  for (const record of [{ ...o,organiserId:'missing' }, { ...o,priceMin:-1 }, { ...o,priceMin:50,priceMax:20 }, { ...o,completionCount:1.5 }, { ...o,lastCompletedDate:'2026-02-30' }]) assert.throws(() => validateRecord('offerings',record,experiences));
  for (const record of [{ ...s,start:'2026-02-30' }, { ...s,start:'2026-11-12T19:00' }, { ...s,start:'2026-12-01',end:'2026-11-01' }, { ...s,offeringId:'missing' }]) assert.throws(() => validateRecord('sessions',record,experiences));
  await mutateExperiences(db,{ action:'delete',kind:'sessions',record:s });
  await mutateExperiences(db,{ action:'delete',kind:'offerings',record:o });
  await mutateExperiences(db,{ action:'delete',kind:'organisers',record:v });
  assert.equal((await readExperiences(db)).organisers.length,23);
});

test('date-only sessions remain current through their last Austin calendar day and terminal statuses stay terminal', () => {
  const s = experienceSeeds().sessions[0];
  assert.equal(austinToday(new Date('2026-11-13T03:00:00Z')),'2026-11-12');
  assert.equal(isUpcomingSession(s,new Date('2026-11-13T03:00:00Z')),true);
  assert.equal(sessionDisplayStatus(s,new Date('2026-11-13T07:00:00Z')),'Past');
  assert.equal(sessionDisplayStatus({ ...s,status:'Attended' },new Date('2027-01-01')),'Attended');
  assert.equal(isUpcomingSession({ ...s,status:'Cancelled' },now),false);
  assert.equal(isUpcomingSession({ ...s,start:'' },now),false);
  assert.equal(isUpcomingSession({ ...s,start:'2026-11-12T19:00:00-06:00',end:'2026-11-12T21:00:00-06:00' },new Date('2026-11-13T02:00:00Z')),true);
});

test('search and combined filters operate on offerings while preserving venue grouping', () => {
  const data = experienceSeeds();
  assert.equal(filterExperiences(data,{ ...filter,search:'knife' },now)[0].organiser.name,'Woodcraft Austin');
  assert.equal(filterExperiences(data,{ ...filter,search:'Woodcraft',category:'Arts & crafts',upcoming:true },now)[0].offerings.length,3);
  assert.equal(filterExperiences(data,{ ...filter,upcoming:true },new Date('2027-01-01')).length,0);
  assert.equal(filterExperiences(data,filter,new Date('2027-01-01')).length,24);
  assert.equal(filterExperiences(data,{ ...filter,maxPrice:'0' },now).length,0); // Unknown is not free.
  data.offerings[0].priceMin = 0; data.offerings[0].priceMax = 0;
  assert.equal(filterExperiences(data,{ ...filter,maxPrice:'0' },now).length,1);
  data.organisers[0].lat = 30.267; data.organisers[0].lng = -97.743;
  assert.equal(filterExperiences(data,{ ...filter,radius:'5',origin:{ lat:30.267,lng:-97.743 } },now).length,1);
  assert.equal(filterExperiences(data,{ ...filter,area:'East Austin' },now)[0].organiser.id,'seed-white-horse');
  assert.equal(priceLabel(null),'Price to check'); assert.equal(priceLabel(0),'Free');
  assert.deepEqual(emptyExperiences(),{ organisers:[],offerings:[],sessions:[] });
});


test('Austin wall-clock session times round-trip through both DST seasons and reject missing spring hours', () => {
  assert.equal(austinTimestamp('2026-11-16','19:30'),'2026-11-17T01:30:00.000Z');
  assert.equal(austinTimestamp('2026-07-16','19:30'),'2026-07-17T00:30:00.000Z');
  assert.deepEqual(austinDateParts('2026-11-17T01:30:00.000Z'),{ date:'2026-11-16',time:'19:30' });
  assert.equal(austinTimestamp('2026-11-16',''),'2026-11-16');
  assert.throws(() => austinTimestamp('2026-03-08','02:30'),/clocks change/);
});
