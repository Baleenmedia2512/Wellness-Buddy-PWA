/**
 * Dry Salad catalog seeds.
 * Run: node --test backend/features/dry-salad/__tests__/seeds.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listSeedProfiles, searchSeedProfiles } from '../domain/seeds.js';
import { validateSearch } from '../validation/search.schema.js';

describe('dry-salad seeds', () => {
  it('lists herbalife dry salad presets', () => {
    const all = listSeedProfiles();
    assert.ok(all.length >= 3);
    assert.ok(all.every((row) => row.normalized_name.includes('herbalife')));
    const row = all[0];
    assert.equal(typeof row.sightings, 'number');
    assert.equal(row.version, 1);
    assert.equal(row.reviewed_by_user_id, null);
  });

  it('matches herbalife query to catalog items', () => {
    const hits = searchSeedProfiles('herbalife');
    assert.ok(hits.length >= 3);
    assert.ok(hits.some((h) => h.normalized_name === 'herbalife dry salad'));
  });

  it('returns all seeds when query is empty', () => {
    const hits = searchSeedProfiles('');
    assert.equal(hits.length, listSeedProfiles().length);
  });
});

describe('validateSearch', () => {
  it('allows empty query so the catalog can list all items', () => {
    assert.deepEqual(validateSearch({}), { searchTerm: '', userId: null });
    assert.equal(validateSearch({ query: 'herbalife' }).searchTerm, 'herbalife');
  });
});
