import test from 'node:test';
import assert from 'node:assert/strict';
import { isWouldReturn, matchesCollectionSearch, groupCollection, sortCollection, type PlaceItem } from '../src/lib/collection';

const place = (id: string, status: string, returns: PlaceItem['return'], type: 'place' | 'hotel' = 'place'): PlaceItem => ({
  id, type, name: id, address: 'Austin', lat: 30.2, lng: -97.7,
  category: type === 'hotel' ? 'Hotels' : 'Food', status, return: returns,
  notes: '', rating: '', priority: '', scope: 'Austin'
});

test('Would Return includes only visited locations with a positive stored flag', () => {
  assert.equal(isWouldReturn(place('Flagged text', 'Visited', 'TRUE')), true);
  assert.equal(isWouldReturn(place('Flagged boolean', 'Visited', true)), true);
  assert.equal(isWouldReturn(place('Unmarked', 'Visited', 'FALSE')), false);
  assert.equal(isWouldReturn(place('Empty', 'Visited', '')), false);
  assert.equal(isWouldReturn(place('No visit', 'To Do', 'TRUE')), false);
});

test('Would Return collection supports places and hotels and existing browsing tools', () => {
  const all = [
    place('Museum', 'Visited', 'TRUE'),
    place('Hotel', 'Visited', true, 'hotel'),
    place('Unmarked', 'Visited', 'FALSE'),
    place('Not yet visited', 'To Do', 'TRUE')
  ];
  const favourites = all.filter(isWouldReturn);
  assert.deepEqual(favourites.map(item => item.name), ['Museum', 'Hotel']);
  assert.deepEqual(sortCollection(favourites, 'name', () => 0).map(item => item.name), ['Hotel', 'Museum']);
  assert.deepEqual(groupCollection(favourites, 'category').map(group => group.label), ['Food', 'Hotels']);
  assert.deepEqual(favourites.filter(item => matchesCollectionSearch(item, 'Hotel')).map(item => item.name), ['Hotel']);
});
