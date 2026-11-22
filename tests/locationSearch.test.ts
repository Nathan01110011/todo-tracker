import test from 'node:test';
import assert from 'node:assert/strict';
import { locationSearchUrl, filterLocationResults, searchLocations, locationDistanceMiles, sortLocationsByDistance } from '../src/lib/locationSearch';

const location = (name: string, country: string, lat = '30.0', lon = '-97.0') => ({
  display_name: name,
  lat, lon,
  address: { country_code: country }
});

const artInstituteResults = [
  location('Art Institute, Sharjah, United Arab Emirates', 'ae', '25.3', '55.5'),
  location('Art Institute, Västra Götaland, Sweden', 'se', '58.0', '11.5'),
  location('The Art Institute of Chicago, Illinois, United States', 'us', '41.8796', '-87.6237'),
  location('Courtauld Institute of Art, London, United Kingdom', 'gb', '51.51', '-0.117'),
  location('Minneapolis Institute of Art, Minnesota, United States', 'US', '44.9596', '-93.2743')
];

test('USA search uses a hard country filter, not only a search box or search ranking', () => {
  const url = new URL(locationSearchUrl('USA', 'Art institute'));
  assert.equal(url.origin, 'https://nominatim.openstreetmap.org');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('countrycodes'), 'us');
  assert.equal(url.searchParams.get('addressdetails'), '1');
  assert.equal(url.searchParams.get('q'), 'Art institute');
  assert.equal(url.searchParams.get('bounded'), null);
  assert.equal(url.searchParams.get('viewbox'), null); // Allow Alaska, Hawaii, etc.

  const results = filterLocationResults(artInstituteResults, 'USA');
  assert.deepEqual(results.map(result => result.display_name), [
    'The Art Institute of Chicago, Illinois, United States',
    'Minneapolis Institute of Art, Minnesota, United States'
  ]);
});

test('regional searches use country and bounded viewport restrictions', () => {
  for (const scope of ['Austin', 'Texas'] as const) {
    const url = new URL(locationSearchUrl(scope, 'museum'));
    assert.equal(url.searchParams.get('countrycodes'), 'us');
    assert.equal(url.searchParams.get('bounded'), '1');
    assert.ok(url.searchParams.get('viewbox'));
  }

  const uk = new URL(locationSearchUrl('UK & Ireland', 'museum'));
  assert.equal(uk.searchParams.get('countrycodes'), 'gb,ie');
  assert.equal(uk.searchParams.get('bounded'), '1');
  assert.deepEqual(filterLocationResults(artInstituteResults, 'UK & Ireland')
    .map(result => result.display_name), ['Courtauld Institute of Art, London, United Kingdom']);
});

test('location search rejects international, ambiguous, and malformed results even if returned by the API', async () => {
  const requests: string[] = [];
  const request = (async (url: string | URL | Request) => {
    requests.push(String(url));
    return new Response(JSON.stringify([
      ...artInstituteResults,
      { display_name: 'Unverified location', lat: '0', lon: '0' },
      location('Broken coordinates', 'us', 'NaN', '-97.0')
    ]), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const results = await searchLocations('USA', 'Art institute', request);
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0]).searchParams.get('countrycodes'), 'us');
  assert.equal(results.length, 2);
  assert.ok(results.every(result => result.address.country_code?.toLowerCase() === 'us'));

  const failed = (async () => new Response('error', { status: 500 })) as typeof fetch;
  await assert.rejects(searchLocations('USA', 'test', failed), /Location search failed/);
  assert.deepEqual(filterLocationResults({ error: 'rate limited' }, 'USA'), []);
});


test('opt-in location keeps hard country boundaries and biases USA results without restricting the country', async () => {
  const chicago = { lat: 41.8818, lng: -87.6278 };
  const url = new URL(locationSearchUrl('USA', 'museum', chicago));
  assert.equal(url.searchParams.get('countrycodes'), 'us');
  assert.equal(url.searchParams.get('bounded'), null);
  assert.ok(url.searchParams.has('viewbox'));
  assert.equal(new URL(locationSearchUrl('USA', 'museum')).searchParams.has('viewbox'), false);
  const texas = new URL(locationSearchUrl('Texas', 'museum', chicago));
  assert.equal(texas.searchParams.get('bounded'), '1');
  assert.equal(texas.searchParams.get('viewbox'), '-106.65,36.5,-93.51,25.84');
  assert.equal(new URL(locationSearchUrl('USA', 'museum', { lat: NaN, lng: -87 })).searchParams.has('viewbox'), false);

  const matches = [
    location('Museum in Seattle', 'us', '47.61', '-122.33'),
    location('Museum near Chicago', 'us', '41.88', '-87.62'),
    location('Museum in Toronto', 'ca', '43.65', '-79.38'),
    location('Museum in Minneapolis', 'us', '44.98', '-93.27')
  ];
  const returned = (async (input: RequestInfo | URL) => {
    const params = new URL(String(input)).searchParams;
    assert.equal(params.get('countrycodes'), 'us');
    assert.ok(params.has('viewbox'));
    return new Response(JSON.stringify(matches), { status: 200 });
  }) as typeof fetch;
  const results = await searchLocations('USA', 'museum', returned, chicago);
  assert.deepEqual(results.map(item => item.display_name), [
    'Museum near Chicago', 'Museum in Minneapolis', 'Museum in Seattle'
  ]);
  assert.equal(matches[0].display_name, 'Museum in Seattle', 'sorting must not mutate the server results');
  assert.ok(locationDistanceMiles(chicago, {lat: 41.88, lng: -87.62}) < 1);
  assert.ok(locationDistanceMiles(chicago, {lat: 44.98, lng: -93.27}) > 300);
});

test('distance ranking is optional and stable when points have identical coordinates', () => {
  const results = [
    location('First Chicago match', 'us', '41.88', '-87.62'),
    location('Second Chicago match', 'us', '41.88', '-87.62'),
    location('Distant match', 'us', '47.61', '-122.33')
  ];
  assert.equal(sortLocationsByDistance(results, null), results);
  assert.deepEqual(sortLocationsByDistance(results, { lat: 41.88, lng: -87.62 })
    .map(item => item.display_name), results.map(item => item.display_name));
});
