import test from 'node:test';
import assert from 'node:assert/strict';
import { capturedTripDay, normalizeTripStop, orderTripStops, reconcileTripTimeline, tripVisitDates, validTripDay } from '../src/lib/tripVisits';

test('trip evidence uses real capture days, typed diary links and only the configured dates', () => {
  const locations = [
    { id:'a',type:'place' as const,scope:'USA',status:'Visited',date:'2025-01-01',photoDetails:[{ capturedAt:'2026:04:12 21:00:00' }] },
    { id:'b',type:'place' as const,scope:'USA',status:'Visited',date:'2026-04-10',photoDetails:[] },
    { id:'c',type:'hotel' as const,scope:'USA',status:'To Do',date:'',photoDetails:[] },
    { id:'d',type:'place' as const,scope:'Austin',status:'Visited',date:'2026-04-11',photoDetails:[] },
    { id:'e',type:'place' as const,scope:'USA',status:'To Do',date:'2026-04-11',photoDetails:[{capturedAt:''}] },
    { id:'f',type:'place' as const,scope:'USA',status:'Visited',date:'2026-04-14',photoDetails:[] },
    { id:'g',type:'place' as const,scope:'USA',status:'To Do',date:'',photoDetails:[{capturedAt:'2026-04-13T13:10:00'}] },
    { id:'ambiguous',type:'place' as const,scope:'USA',status:'To Do',date:'',photoDetails:[{capturedAt:'2026:04:12 12:00:00'}] },
    { id:'ambiguous',type:'hotel' as const,scope:'USA',status:'To Do',date:'',photoDetails:[{capturedAt:'2026:04:12 12:00:00'}] },
  ];
  const diary = [
    {placeId:'c',placeType:'hotel',scope:'USA',date:'2026-04-11'},
    {placeId:'a',placeType:'place',scope:'USA',date:'2026-04-13'},
    {placeId:'e',placeType:'place',scope:'USA',date:'2026-04-15'},
    {placeId:'',placeType:'general-photo',scope:'USA',date:'2026-04-12'},
    {placeId:'ambiguous',placeType:'hotel',scope:'USA',date:'2026-04-10'},
    {placeId:'b',placeType:'place',scope:'Austin',date:'2026-04-12'},
  ];
  const dates = tripVisitDates({scope:'USA',startDate:'2026-04-10',endDate:'2026-04-13'},locations,diary,'2026-11-21');
  assert.deepEqual(dates,{
    'place:a':'2026-04-12',
    'place:b':'2026-04-10',
    'hotel:c':'2026-04-11',
    'place:g':'2026-04-13',
    'hotel:ambiguous':'2026-04-10'
  });
  assert.equal(tripVisitDates({scope:'USA',startDate:'',endDate:''},locations,diary,'2026-11-21')['place:b'],undefined);
  assert.equal(tripVisitDates({scope:'USA',startDate:'2026-04-12'},locations,diary,'2026-04-11')['place:a'],undefined);
  assert.deepEqual(tripVisitDates({scope:'USA',startDate:'2026-04-13',endDate:'2026-04-10'},locations,diary,'2026-11-21'),{});
});

test('trip reconciliation is idempotent and preserves prior stops and completion', () => {
  const original = { placeIds:['place:unvisited','a'],completedPlaceIds:['place:unvisited'] };
  const dates = {'place:a':'2026-04-12','hotel:c':'2026-04-10','place:b':'2026-04-11'};
  const first = reconcileTripTimeline(original,dates);
  assert.deepEqual(first.placeIds,['place:unvisited','a','hotel:c','place:b']);
  assert.deepEqual(first.completedPlaceIds,['place:unvisited','a','hotel:c','place:b']);
  assert.deepEqual(first.addedIds,['hotel:c','place:b']);
  assert.deepEqual(first.newlyCompletedIds,['a','hotel:c','place:b']);
  const second = reconcileTripTimeline(first,dates);
  assert.deepEqual(second.addedIds,[]);
  assert.deepEqual(second.newlyCompletedIds,[]);
  assert.deepEqual(second.placeIds,first.placeIds);
  assert.deepEqual(second.completedPlaceIds,first.completedPlaceIds);
});

test('trip stops display completed visits chronologically, then keep remaining planned order', () => {
  const ids=['place:planned2','place:a','place:planned1','hotel:h','place:b','place:manual'];
  const dates={'place:a':'2026-04-13','hotel:h':'2026-04-10','place:b':'2026-04-10'};
  assert.deepEqual(orderTripStops(ids,['place:a','hotel:h','place:b','place:manual'],dates),
    ['hotel:h','place:b','place:a','place:manual','place:planned2','place:planned1']);
  assert.equal(normalizeTripStop('historic'),'place:historic');
  assert.equal(normalizeTripStop('hotel:h'),'hotel:h');
  assert.equal(capturedTripDay('2026:04:11 14:00:00'),'2026-04-11');
  assert.equal(capturedTripDay('2026-02-30T11:00:00'),'');
  assert.equal(validTripDay('2026-02-30'),false);
  assert.equal(validTripDay('2026-04-11'),true);
});
