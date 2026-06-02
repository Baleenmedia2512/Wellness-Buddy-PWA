/**
 * Unit tests for shared/lib/reverseGeocode.js
 *
 * Discipline: Unit (no network; fetch is mocked globally).
 * Coverage target: 95% line / 90% branch (shared/ floor — claude.md §9.1).
 */

import { fetchCityVillage } from '../reverseGeocode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchMock(status, body) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchCityVillage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns city and village from a full Nominatim response', async () => {
    global.fetch = makeFetchMock(200, {
      display_name: 'Koramangala, Bangalore, Karnataka, India',
      address: {
        city: 'Bangalore',
        neighbourhood: 'Koramangala',
        suburb: '5th Block',
      },
    });

    const result = await fetchCityVillage(12.9352, 77.6245);

    expect(result).toEqual({ city: 'Bangalore', village: 'Koramangala, 5th Block' });
  });

  it('falls back to town when city is absent', async () => {
    global.fetch = makeFetchMock(200, {
      display_name: 'Some Town',
      address: { town: 'MyTown' },
    });

    const result = await fetchCityVillage(10.0, 80.0);
    expect(result.city).toBe('MyTown');
  });

  it('returns null city and null village when address block is missing', async () => {
    global.fetch = makeFetchMock(200, { display_name: 'Somewhere', address: null });

    const result = await fetchCityVillage(10.0, 80.0);
    expect(result).toEqual({ city: null, village: null });
  });

  it('returns null fields when Nominatim returns non-OK status', async () => {
    global.fetch = makeFetchMock(500, {});

    const result = await fetchCityVillage(10.0, 80.0);
    expect(result).toEqual({ city: null, village: null });
  });

  it('returns null fields when fetch throws a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

    const result = await fetchCityVillage(10.0, 80.0);
    expect(result).toEqual({ city: null, village: null });
  });

  it('returns null fields without calling fetch when latitude is null', async () => {
    global.fetch = jest.fn();

    const result = await fetchCityVillage(null, 80.0);
    expect(result).toEqual({ city: null, village: null });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null fields without calling fetch when longitude is null', async () => {
    global.fetch = jest.fn();

    const result = await fetchCityVillage(10.0, null);
    expect(result).toEqual({ city: null, village: null });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deduplicates suburb when it equals neighbourhood', async () => {
    global.fetch = makeFetchMock(200, {
      display_name: 'Test',
      address: {
        city: 'City',
        neighbourhood: 'SameArea',
        suburb: 'SameArea', // intentional duplicate
        hamlet: 'SmallPlace',
      },
    });

    const result = await fetchCityVillage(10.0, 80.0);
    // suburb must not be added twice; hamlet is included
    expect(result.village).toBe('SameArea, SmallPlace');
  });

  it('builds village from hamlet alone when no neighbourhood/suburb exists', async () => {
    global.fetch = makeFetchMock(200, {
      display_name: 'Hamlet Town',
      address: { city: 'BigCity', hamlet: 'TinyHamlet' },
    });

    const result = await fetchCityVillage(10.0, 80.0);
    expect(result).toEqual({ city: 'BigCity', village: 'TinyHamlet' });
  });

  it('returns null village when no sub-locality fields are present', async () => {
    global.fetch = makeFetchMock(200, {
      display_name: 'City Only',
      address: { city: 'OnlyCity' },
    });

    const result = await fetchCityVillage(10.0, 80.0);
    expect(result).toEqual({ city: 'OnlyCity', village: null });
  });
});
