/**
 * Run: node --test frontend/src/features/wellness-score-sheet/services/__tests__/dayMeals.api.test.js
 */
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRangeMealsForScore } from '../dayMeals.api.js';

describe('fetchRangeMealsForScore', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mock.fn(async (url) => {
      const u = String(url);
      const date = new URL(u, 'http://local').searchParams.get('date');
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [{ CreatedAt: `${date}T12:00:00`, TotalCalories: 100, AnalysisData: { foods: [] } }],
        }),
      };
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns empty when dates missing', async () => {
    const list = await fetchRangeMealsForScore({
      userId: '1',
      dates: [],
      apiBaseUrl: 'http://api.test',
    });
    assert.deepEqual(list, []);
    assert.equal(globalThis.fetch.mock.calls.length, 0);
  });

  it('fetches each unique date and concatenates meals', async () => {
    const list = await fetchRangeMealsForScore({
      userId: '42',
      dates: ['2026-07-20', '2026-07-21', '2026-07-20'],
      apiBaseUrl: 'http://api.test',
    });
    assert.equal(list.length, 2);
    assert.equal(globalThis.fetch.mock.calls.length, 2);
    assert.match(String(globalThis.fetch.mock.calls[0].arguments[0]), /date=2026-07-20/);
    assert.match(String(globalThis.fetch.mock.calls[1].arguments[0]), /date=2026-07-21/);
  });
});
