import test from 'node:test';
import assert from 'node:assert/strict';
import { locationSearchUrl, filterLocationResults, searchLocations } from '../src/lib/locationSearch';

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
