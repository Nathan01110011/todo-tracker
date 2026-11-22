import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/places';
import { sharedDoc } from './fakeSheets';

process.env.PASSWORD = 'test-owner';
process.env.SHEET_ID = 'fake-sheet';
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.invalid';
process.env.GOOGLE_PRIVATE_KEY = 'fake-key';
const request = async (method: string, body?: any, authorization?: string) => {
  let status = 200, data: any;
  await handler({ method, body, headers:{ authorization } } as any, { status(code: number) { status=code; return this; }, json(value: any) { data=value; return this; } } as any);
  return { status,data };
};

test('existing API protects experience writes, leaves public reads and legacy collections intact', async () => {
  sharedDoc.sheetsByTitle = {};
  assert.equal((await request('POST',{ type:'experience',action:'import' })).status,401);
  assert.equal(Object.keys(sharedDoc.sheetsByTitle).length,0);
  assert.equal((await request('GET',undefined,'wrong')).status,401);
  const read = await request('GET');
  assert.equal(read.status,200);
  assert.deepEqual(read.data.experiences,{ organisers:[],offerings:[],sessions:[] });
  const places = await sharedDoc.addSheet({ title:'Places',headerValues:['id','name','category','lat','lng','scope'] });
  await places.addRow({ id:'legacy',name:'My saved place',category:'Food',scope:'Austin' });
  const imported = await request('POST',{ type:'experience',action:'import' },'test-owner');
  assert.equal(imported.status,200);
  assert.equal(imported.data.experiences.organisers.length,24);
  const reread = await request('GET');
  assert.equal(reread.data.places[0].name,'My saved place');
  assert.equal(reread.data.experiences.sessions.length,15);
  assert.equal((await request('POST',{ type:'experience',action:'import' },'test-owner')).data.imported,0);
  const invalid = await request('POST',{ type:'experience',action:'save',kind:'sessions',record:{ title:'orphan' } },'test-owner');
  assert.equal(invalid.status,400);
});


test('photo uploads mark places visited, keep the original visit date, and create one diary entry per day', async () => {
  sharedDoc.sheetsByTitle = {};
  const places = await sharedDoc.addSheet({ title:'Places', headerValues:['id','name','address','category','lat','lng','status','date','scope'] });
  const photos = await sharedDoc.addSheet({ title:'Photos', headerValues:['locationId','url'] });
  await places.addRow({ id:'museum', name:'Museum', address:'Main St', category:'Activities', lat:'30.2', lng:'-97.7', status:'To Do', date:'', scope:'Austin' });
  await places.addRow({ id:'cafe', name:'Cafe', category:'Food', status:'To Do', date:'', scope:'Austin' });
  await places.addRow({ id:'favourite', name:'Old Favourite', category:'Food', status:'Visited', date:'2026-01-12', scope:'Austin' });

  const owner = 'test-owner';
  const first = await request('POST', { id:'museum', type:'place', photoUrl:'https://example.com/1.jpg', capturedAt:'2026:11:10 18:00:00', visitDate:'2026-11-13', recordDiary:true }, owner);
  assert.equal(first.status,200);
  assert.deepEqual(first.data.visit,{ status:'Visited', date:'2026-11-10' });
  assert.equal(first.data.diaryEntry?.date,'2026-11-10');
  assert.equal(first.data.diaryEntry?.placeId,'museum');
  assert.equal(places.rows[0].get('status'),'Visited');
  assert.equal(places.rows[0].get('date'),'2026-11-10');
  assert.equal(photos.rows.length,1);
  assert.equal(photos.rows[0].get('capturedAt'),'2026:11:10 18:00:00');
  const diary = sharedDoc.sheetsByTitle.Diary;
  assert.equal(diary.rows.length,1);
  assert.equal(diary.rows[0].get('name'),'Museum');

  // Multiple photos (and retried upload links) on one day must not duplicate diary visits.
  const second = await request('POST', { id:'museum', type:'place', photoUrl:'https://example.com/2.jpg', capturedAt:'2026:11:10 19:00:00', visitDate:'2026-11-13' }, owner);
  assert.equal(second.status,200);
  assert.equal(second.data.diaryEntry,null);
  assert.equal(diary.rows.length,1);
  const retry = await request('POST', { id:'museum', type:'place', photoUrl:'https://example.com/2.jpg', capturedAt:'2026:11:10 19:00:00' }, owner);
  assert.equal(retry.status,200);
  assert.equal(photos.rows.length,2);
  assert.equal(diary.rows.length,1);

  // A subsequent visit gets its own diary entry, but not a replacement place visit date.
  const later = await request('POST', { id:'museum', type:'place', photoUrl:'https://example.com/3.jpg', capturedAt:'2026:11:12 14:00:00' }, owner);
  assert.equal(later.data.diaryEntry?.date,'2026-11-12');
  assert.equal(later.data.visit.date,'2026-11-10');
  assert.equal(places.rows[0].get('date'),'2026-11-10');
  assert.equal(diary.rows.length,2);

  // EXIF-free images use the browser's local upload date.
  const noExif = await request('POST', { id:'cafe', type:'place', photoUrl:'https://example.com/no-exif.jpg', visitDate:'2026-11-13' }, owner);
  assert.equal(noExif.data.visit.date,'2026-11-13');
  assert.equal(noExif.data.diaryEntry?.date,'2026-11-13');
  assert.equal(places.rows[1].get('status'),'Visited');

  // An existing manually entered date must survive the new upload.
  const favourite = await request('POST', { id:'favourite', type:'place', photoUrl:'https://example.com/fave.jpg', capturedAt:'2026:11:09 11:00:00' }, owner);
  assert.equal(favourite.data.visit.date,'2026-01-12');
  assert.equal(places.rows[2].get('date'),'2026-01-12');
  assert.equal(favourite.data.diaryEntry?.date,'2026-11-09');

  // Don't leave orphan photo records if the location cannot be found.
  const unknown = await request('POST', { id:'unknown', type:'place', photoUrl:'https://example.com/orphan.jpg' }, owner);
  assert.equal(unknown.status,404);
  assert.equal(photos.rows.length,5);
});

test('hotel photos are supported, diary auto-sync can be disabled, and manual visit toggles set dates', async () => {
  sharedDoc.sheetsByTitle = {};
  const places = await sharedDoc.addSheet({ title:'Places', headerValues:['id','name','status','date','scope'] });
  const hotels = await sharedDoc.addSheet({ title:'Hotels', headerValues:['id','name','status','date','scope'] });
  await sharedDoc.addSheet({ title:'Photos', headerValues:['locationId','url'] });
  await places.addRow({ id:'manual', name:'Manual place', status:'To Do', date:'', scope:'Austin' });
  await hotels.addRow({ id:'hotel-one', name:'Hotel', status:'To Do', date:'', scope:'Austin' });

  const photo = await request('POST', { id:'hotel-one', type:'hotel', photoUrl:'https://example.com/hotel.jpg', visitDate:'2026-11-13', recordDiary:false }, 'test-owner');
  assert.equal(photo.status,200);
  assert.equal(photo.data.visit.status,'Visited');
  assert.equal(photo.data.visit.date,'2026-11-13');
  assert.equal(photo.data.diaryEntry,null);
  assert.equal(sharedDoc.sheetsByTitle.Diary,undefined);
  assert.equal(hotels.rows[0].get('status'),'Visited');

  const marked = await request('POST', { id:'manual', status:'Visited' }, 'test-owner');
  assert.equal(marked.status,200);
  assert.equal(places.rows[0].get('date'),new Date().toISOString().slice(0,10));
  const unmarked = await request('POST', { id:'manual', status:'To Do' }, 'test-owner');
  assert.equal(unmarked.status,200);
  assert.equal(places.rows[0].get('date'),'');
});


test('Would Return flags persist for existing places and hotels, including legacy sheets without the column', async () => {
  sharedDoc.sheetsByTitle = {};
  const places = await sharedDoc.addSheet({ title:'Places', headerValues:['id','name','status','scope'] });
  const hotels = await sharedDoc.addSheet({ title:'Hotels', headerValues:['id','name','status','scope'] });
  await places.addRow({ id:'p1', name:'Restaurant', status:'Visited', scope:'Austin' });
  await hotels.addRow({ id:'h1', name:'Hotel', status:'Visited', scope:'Austin' });

  const placeSet = await request('POST', { id:'p1', type:'place', return:true }, 'test-owner');
  const hotelSet = await request('POST', { id:'h1', type:'hotel', return:true }, 'test-owner');
  assert.equal(placeSet.status,200);
  assert.equal(hotelSet.status,200);
  assert.ok(places.headerValues.includes('return'));
  assert.ok(hotels.headerValues.includes('return'));
  assert.ok(hotels.headerValues.includes('date'));

  const read = await request('GET');
  assert.equal(read.status,200);
  assert.equal(read.data.places[0].return,'TRUE');
  assert.equal(read.data.hotels[0].return,'TRUE');

  const unset = await request('POST', { id:'h1', type:'hotel', return:false }, 'test-owner');
  assert.equal(unset.status,200);
  const reread = await request('GET');
  assert.equal(reread.data.places[0].return,'TRUE');
  assert.equal(reread.data.hotels[0].return,'FALSE');
});


test('standalone diary photos save camera date and GPS without marking a destination visited', async () => {
  sharedDoc.sheetsByTitle = {};
  const previousCloud = process.env.VITE_CLOUDINARY_CLOUD_NAME;
  process.env.VITE_CLOUDINARY_CLOUD_NAME = 'sample-cloud';
  try {
    const places = await sharedDoc.addSheet({ title:'Places', headerValues:['id','name','status','date','scope'] });
    await places.addRow({ id:'museum', name:'Museum', status:'To Do', date:'', scope:'Austin' });
    const url = 'https://res.cloudinary.com/sample-cloud/image/upload/v1700000000/tracker_photos/photo-one.jpg';
    const payload = { type:'diary', action:'addPhoto', photoUrl:url, capturedAt:'2026:11:10 15:42:03',
      uploadedAt:'2026-11-16T10:00:00Z', lat:30.2672, lng:-97.7431, date:'2026-11-16' };
    const result = await request('POST', payload, 'test-owner');
    assert.equal(result.status, 200);
    assert.equal(result.data.entry.date, '2026-11-10');
    assert.equal(result.data.entry.placeType, 'general-photo');
    assert.equal(result.data.entry.scope, 'General');
    assert.equal(result.data.entry.lat, 30.2672);
    assert.equal(result.data.entry.lng, -97.7431);
    assert.equal(result.data.entry.photos[0].capturedAt, '2026:11:10 15:42:03');
    assert.equal(places.rows[0].get('status'), 'To Do');
    assert.equal(places.rows[0].get('date'), '');

    const photos = sharedDoc.sheetsByTitle.Photos;
    const diary = sharedDoc.sheetsByTitle.Diary;
    assert.equal(photos.rows.length, 1);
    assert.equal(photos.rows[0].get('locationId'), 'diary:' + result.data.entry.id);
    assert.ok(photos.headerValues.includes('capturedAt'));
    assert.equal(diary.rows.length, 1);

    const reread = await request('GET');
    assert.equal(reread.status, 200);
    assert.deepEqual(reread.data.diaryEntries[0].photos, result.data.entry.photos);

    // A retry for the same Cloudinary URL must not create duplicates.
    const retry = await request('POST', payload, 'test-owner');
    assert.equal(retry.status, 200);
    assert.equal(retry.data.entry.id, result.data.entry.id);
    assert.equal(diary.rows.length, 1);
    assert.equal(photos.rows.length, 1);

    // Deleting the diary entry removes the photo relationship too.
    const deleted = await request('POST', { type:'diary', action:'delete', id:result.data.entry.id }, 'test-owner');
    assert.equal(deleted.status, 200);
    assert.equal(photos.rows.length, 0);
    assert.equal(diary.rows.length, 0);

    const noGpsUrl = 'https://res.cloudinary.com/sample-cloud/image/upload/v1700000000/tracker_photos/photo-two.jpg';
    const noGps = await request('POST', { type:'diary', action:'addPhoto', photoUrl:noGpsUrl,
      date:'2026-11-09', lat:null, lng:null }, 'test-owner');
    assert.equal(noGps.status, 200);
    assert.equal(noGps.data.entry.date, '2026-11-09');
    assert.equal(noGps.data.entry.lat, 0);
    assert.equal(noGps.data.entry.lng, 0);
    assert.equal(noGps.data.entry.photos.length, 1);

    // GPS metadata can be restored later from a reselected original file or
    // from a manually placed map pin, without changing image or capture date.
    const invalidCoordinates = await request('POST', {
      type:'diary', action:'updateLocation', id:noGps.data.entry.id, lat:91, lng:-97
    }, 'test-owner');
    assert.equal(invalidCoordinates.status, 400);
    const missingCoordinates = await request('POST', {
      type:'diary', action:'updateLocation', id:noGps.data.entry.id, lat:null, lng:null
    }, 'test-owner');
    assert.equal(missingCoordinates.status, 400);
    const savedPin = await request('POST', {
      type:'diary', action:'updateLocation', id:noGps.data.entry.id, lat:30.264, lng:-97.741
    }, 'test-owner');
    assert.equal(savedPin.status, 200);
    assert.deepEqual({ lat:savedPin.data.lat, lng:savedPin.data.lng },
      { lat:30.264, lng:-97.741 });
    const pinned = (await request('GET')).data.diaryEntries[0];
    assert.equal(pinned.id, noGps.data.entry.id);
    assert.equal(pinned.lat, 30.264);
    assert.equal(pinned.lng, -97.741);
    assert.equal(pinned.date, '2026-11-09');
    assert.equal(pinned.photos[0].url, noGpsUrl);

    const external = await request('POST', { type:'diary', action:'addPhoto',
      photoUrl:'https://example.com/evil.jpg' }, 'test-owner');
    assert.equal(external.status, 400);
    assert.equal(diary.rows.length, 1);
    assert.equal(photos.rows.length, 1);
  } finally {
    if (previousCloud === undefined) delete process.env.VITE_CLOUDINARY_CLOUD_NAME;
    else process.env.VITE_CLOUDINARY_CLOUD_NAME = previousCloud;
  }
});


test('Landmarks are ordinary saved places with editable category, visit dates and filtering metadata', async () => {
  sharedDoc.sheetsByTitle = {};
  await sharedDoc.addSheet({ title: 'Places', headerValues: [
    'id', 'category', 'name', 'address', 'lat', 'lng', 'scope', 'status', 'date', 'details'
  ] });
  const created = await request('POST', {
    type: 'place', category: 'Landmarks', name: 'State Capitol',
    address: 'Austin, Texas', lat: 30.2747, lng: -97.7404, scope: 'Austin'
  }, 'test-owner');
  assert.equal(created.status, 200);
  assert.ok(created.data.id);

  const firstRead = await request('GET');
  assert.equal(firstRead.data.places[0].category, 'Landmarks');
  assert.equal(firstRead.data.places[0].status, 'To Do');
  assert.equal(firstRead.data.places[0].scope, 'Austin');

  const visited = await request('POST', {
    id: created.data.id, type: 'place', category: 'Landmarks', status: 'Visited',
    date: '2026-11-16', notes: 'Nice view'
  }, 'test-owner');
  assert.equal(visited.status, 200);
  const secondRead = await request('GET');
  assert.equal(secondRead.data.places[0].category, 'Landmarks');
  assert.equal(secondRead.data.places[0].status, 'Visited');
  assert.equal(secondRead.data.places[0].date, '2026-11-16');
  assert.equal(secondRead.data.places[0].notes, 'Nice view');

  const reclassified = await request('POST', {
    id: created.data.id, type: 'place', category: 'Activities'
  }, 'test-owner');
  assert.equal(reclassified.status, 200);
  const finalRead = await request('GET');
  assert.equal(finalRead.data.places[0].category, 'Activities');
});


test('trips can be edited in place with optional dates and existing completion state', async () => {
  sharedDoc.sheetsByTitle = {};
  const owner = 'test-owner';
  const sheet = await sharedDoc.addSheet({ title:'Routes', headerValues:['id','name','placeIds','scope','tripType','completedPlaceIds','status'] });
  await sheet.addRow({ id:'chicago', name:'Chicago', placeIds:'place:a,place:b', scope:'USA', tripType:'ordered', completedPlaceIds:'place:a', status:'active' });
  const old = await request('GET');
  assert.equal(old.status,200);
  assert.equal(old.data.routes[0].startDate,'');
  assert.equal(old.data.routes[0].endDate,'');
  const edit = { type:'route', action:'update', id:'chicago', name:'Chicago break', placeIds:['place:a','hotel:c'], tripType:'unordered', completedPlaceIds:['place:a'], startDate:'2026-11-22', endDate:'2026-11-26' };
  assert.equal((await request('POST',edit)).status,401);
  assert.equal((await request('POST',edit,owner)).status,200);
  const read = await request('GET');
  assert.equal(read.data.routes.length,1);
  assert.deepEqual(read.data.routes[0],{ id:'chicago', name:'Chicago break', placeIds:['place:a','hotel:c'], scope:'USA', tripType:'unordered', completedPlaceIds:['place:a'], status:'active', startDate:'2026-11-22', endDate:'2026-11-26' });
  assert.equal((await request('POST',{ ...edit, endDate:'2026-11-21' },owner)).status,400);
  assert.equal((await request('POST',{ ...edit, startDate:'2026-02-30' },owner)).status,400);
  assert.equal((await request('GET')).data.routes[0].endDate,'2026-11-26');
  assert.equal((await request('POST',{ type:'route', id:'chicago', action:'update', endDate:'' },owner)).status,200);
  assert.equal((await request('GET')).data.routes[0].endDate,'');
  assert.equal((await request('POST',{ type:'route', id:'chicago', action:'update', startDate:'' },owner)).status,200);
  assert.equal((await request('GET')).data.routes[0].startDate,'');
  const created = await request('POST',{ type:'route', name:'Day trip', placeIds:['place:z'], scope:'USA', startDate:'2026-12-01' },owner);
  assert.equal(created.status,200);
  const day = (await request('GET')).data.routes.find((route: any) => route.id === created.data.id);
  assert.equal(day.startDate,'2026-12-01');
  assert.equal(day.endDate,'');
  assert.equal(day.status,'planned');
});


test('photos check off only the matching dated trip stops, using capture date and not upload date', async () => {
  sharedDoc.sheetsByTitle = {};
  const places = await sharedDoc.addSheet({ title:'Places', headerValues:['id','name','status','date','scope'] });
  const hotels = await sharedDoc.addSheet({ title:'Hotels', headerValues:['id','name','status','date','scope'] });
  await sharedDoc.addSheet({ title:'Photos', headerValues:['locationId','url'] });
  const routes = await sharedDoc.addSheet({ title:'Routes', headerValues:['id','name','placeIds','scope','tripType','completedPlaceIds','status','startDate','endDate'] });
  await places.addRow({ id:'museum', name:'Museum', status:'Visited', date:'2025-01-01', scope:'USA' });
  await hotels.addRow({ id:'museum', name:'Hotel', status:'To Do', scope:'USA' });
  const add = (id:string,startDate:string,endDate:string,placeIds='place:museum,place:other',completedPlaceIds='',status='planned') =>
    routes.addRow({ id,name:id,placeIds,scope:'USA',tripType:'unordered',completedPlaceIds,status,startDate,endDate });
  await add('multi','2026-01-10','2026-01-12','place:museum,place:other','place:other','active');
  await add('single','2026-01-12','');
  await add('earlier','2026-01-09','2026-01-11');
  await add('undated','','');
  await add('unrelated','2026-01-12','','place:other');
  await add('hotel','2026-01-12','','hotel:museum');
  await add('legacy','2026-01-12','','museum');
  const upload = (url:string,capturedAt:string,type='place') => request('POST',{ id:'museum',type,photoUrl:'https://example.com/'+url,capturedAt,visitDate:'2026-01-12',recordDiary:false },'test-owner');
  const missing = await upload('missing.jpg','');
  assert.deepEqual(missing.data.tripUpdates,[]);
  const invalid = await upload('invalid.jpg','2026:02:30 10:00:00');
  assert.deepEqual(invalid.data.tripUpdates,[]);
  const photo = await upload('old.jpg','2026:01:12 13:00:00');
  assert.equal(photo.status,200);
  assert.deepEqual(photo.data.tripUpdates.map((trip:any)=>trip.id),['multi','single','legacy']);
  assert.equal(photo.data.visit.date,'2025-01-01');
  assert.deepEqual(photo.data.tripUpdates[0].completedPlaceIds,['place:other','place:museum']);
  assert.equal((await upload('old.jpg','2026:01:12 13:00:00')).data.tripUpdates.length,0);
  const hotel = await upload('hotel.jpg','2026-01-12T14:00:00','hotel');
  assert.deepEqual(hotel.data.tripUpdates.map((trip:any)=>trip.id),['hotel']);
  const read = await request('GET');
  const byId = (id:string) => read.data.routes.find((route:any)=>route.id===id);
  assert.equal(byId('multi').status,'active');
  assert.equal(byId('single').status,'planned');
  assert.deepEqual(byId('earlier').completedPlaceIds,[]);
  assert.deepEqual(byId('undated').completedPlaceIds,[]);
  assert.deepEqual(byId('unrelated').completedPlaceIds,[]);
});
