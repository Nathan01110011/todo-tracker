import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaceSearchUrl, SCOPE_CONFIG, SCOPE_NAMES } from '../src/lib/scopeConfig';

test('USA search is restricted to US results, not worldwide matches', () => {
  const url = new URL(buildPlaceSearchUrl('Springfield', 'USA'));
  assert.equal(url.origin, 'https://nominatim.openstreetmap.org');
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('q'), 'Springfield');
  assert.equal(url.searchParams.get('countrycodes'), 'us');
  assert.equal(url.searchParams.has('bounded'), false);
});

test('shared URL builder safely encodes search terms for add-place and diary searches', () => {
  const url = new URL(buildPlaceSearchUrl('New York & Brooklyn', 'USA'));
  assert.equal(url.searchParams.get('q'), 'New York & Brooklyn');
  assert.equal(url.searchParams.get('countrycodes'), 'us');
  assert.equal(url.searchParams.getAll('q').length, 1);
});

test('other tracker scopes retain their existing geographic search bounds', () => {
  assert.deepEqual(SCOPE_NAMES, ['Austin', 'Texas', 'USA', 'UK & Ireland']);
  for (const scope of ['Austin', 'Texas', 'UK & Ireland'] as const) {
    const url = new URL(buildPlaceSearchUrl('Museum', scope));
    assert.equal(url.searchParams.get('bounded'), '1');
    assert.equal(url.searchParams.get('viewbox'), new URLSearchParams(SCOPE_CONFIG[scope].searchParams.slice(1)).get('viewbox'));
  }
});
