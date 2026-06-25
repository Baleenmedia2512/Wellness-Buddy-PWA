/**
 * Regression tests for food-corrections.service.searchFoodHistory.
 *
 * The primary purpose of this file is to LOCK IN the "latest record wins"
 * dedup invariant documented in `food-corrections.service.js :: dedupItems`
 * and ADR-0003. The behaviour relies on TWO independent pieces of code
 * cooperating:
 *
 *   1. The repository returns rows ordered by `CreatedAt DESC`.
 *   2. The service's `dedupItems` keeps the FIRST row processed per name.
 *
 * Together those produce "latest-wins". A future refactor that removes
 * either side independently would silently regress the Diary spec
 * (ADR-0003 §"Pinned product answers" — "use latest record's nutrition").
 * These tests fail loudly if that happens.
 */

import * as service from '../food-corrections.service.js';

jest.mock('../food-corrections.repository.js', () => ({
  searchUserMeals: jest.fn(),
  searchCommunityMeals: jest.fn(),
}));

import * as repo from '../food-corrections.repository.js';

const mealRow = ({ id, createdAt, foods }) => ({
  ID: id,
  CreatedAt: createdAt,
  AnalysisData: JSON.stringify({ foods }),
});

const foodEntry = ({ name, calories, protein = null, carbs = null, fat = null }) => ({
  name,
  weight_g: 100,
  nutrition: { calories, protein, carbs, fat },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('searchFoodHistory — latest-wins dedup invariant (ADR-0003 PR-A)', () => {
  it('returns the nutrition from the newest row when the same food name appears twice', async () => {
    // Repo MUST return DESC by CreatedAt — newest first.
    repo.searchUserMeals.mockResolvedValueOnce([
      mealRow({
        id: 200,
        createdAt: '2026-06-05T10:00:00+05:30',
        foods: [foodEntry({ name: 'dosa', calories: 320 })], // latest
      }),
      mealRow({
        id: 100,
        createdAt: '2026-05-01T10:00:00+05:30',
        foods: [foodEntry({ name: 'dosa', calories: 180 })], // older — must lose
      }),
    ]);
    repo.searchCommunityMeals.mockResolvedValueOnce([]);

    const out = await service.searchFoodHistory({ userId: '7', searchTerm: 'dosa' });

    expect(out.httpStatus).toBe(200);
    expect(out.body.success).toBe(true);
    expect(out.body.myItems).toHaveLength(1);
    expect(out.body.myItems[0]).toMatchObject({
      name: 'dosa',
      calories: 320, // NEWEST value, not 180
    });
  });

  it('applies the latest-wins rule independently to myItems and communityItems', async () => {
    repo.searchUserMeals.mockResolvedValueOnce([
      mealRow({
        id: 2,
        createdAt: '2026-06-05T10:00:00+05:30',
        foods: [foodEntry({ name: 'idli', calories: 80 })],
      }),
      mealRow({
        id: 1,
        createdAt: '2026-05-01T10:00:00+05:30',
        foods: [foodEntry({ name: 'idli', calories: 150 })],
      }),
    ]);
    repo.searchCommunityMeals.mockResolvedValueOnce([
      mealRow({
        id: 20,
        createdAt: '2026-06-04T10:00:00+05:30',
        foods: [foodEntry({ name: 'idli', calories: 90 })],
      }),
      mealRow({
        id: 10,
        createdAt: '2026-04-01T10:00:00+05:30',
        foods: [foodEntry({ name: 'idli', calories: 200 })],
      }),
    ]);

    const out = await service.searchFoodHistory({ userId: '7', searchTerm: 'idli' });

    expect(out.body.myItems).toEqual([expect.objectContaining({ name: 'idli', calories: 80 })]);
    expect(out.body.communityItems).toEqual([
      expect.objectContaining({ name: 'idli', calories: 90 }),
    ]);
  });

  it('does NOT collapse different names even with same string substring', async () => {
    // Filter is case-insensitive substring match on the food name.
    repo.searchUserMeals.mockResolvedValueOnce([
      mealRow({
        id: 1,
        createdAt: '2026-06-05T10:00:00+05:30',
        foods: [
          foodEntry({ name: 'masala dosa',  calories: 350 }),
          foodEntry({ name: 'paneer dosa',  calories: 420 }),
          foodEntry({ name: 'dosa',         calories: 300 }),
        ],
      }),
    ]);
    repo.searchCommunityMeals.mockResolvedValueOnce([]);

    const out = await service.searchFoodHistory({ userId: '7', searchTerm: 'dosa' });

    expect(out.body.myItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'masala dosa', calories: 350 }),
      expect.objectContaining({ name: 'paneer dosa', calories: 420 }),
      expect.objectContaining({ name: 'dosa',        calories: 300 }),
    ]));
    expect(out.body.myItems).toHaveLength(3);
  });

  it('returns empty arrays when neither store has matches (no 500)', async () => {
    repo.searchUserMeals.mockResolvedValueOnce([]);
    repo.searchCommunityMeals.mockResolvedValueOnce([]);

    const out = await service.searchFoodHistory({ userId: '7', searchTerm: 'kale' });

    expect(out.httpStatus).toBe(200);
    expect(out.body).toEqual({ success: true, myItems: [], communityItems: [] });
  });

  it('ignores rows whose AnalysisData is malformed JSON (no crash, no match)', async () => {
    repo.searchUserMeals.mockResolvedValueOnce([
      { ID: 1, CreatedAt: '2026-06-05T10:00:00+05:30', AnalysisData: '{not json' },
      mealRow({
        id: 2,
        createdAt: '2026-06-05T11:00:00+05:30',
        foods: [foodEntry({ name: 'roti', calories: 110 })],
      }),
    ]);
    repo.searchCommunityMeals.mockResolvedValueOnce([]);

    const out = await service.searchFoodHistory({ userId: '7', searchTerm: 'roti' });

    expect(out.body.myItems).toEqual([
      expect.objectContaining({ name: 'roti', calories: 110 }),
    ]);
  });

  it('case-insensitive name matching does not break dedup keying', async () => {
    repo.searchUserMeals.mockResolvedValueOnce([
      mealRow({
        id: 2,
        createdAt: '2026-06-05T10:00:00+05:30',
        foods: [foodEntry({ name: 'Dosa', calories: 320 })], // latest, capitalised
      }),
      mealRow({
        id: 1,
        createdAt: '2026-05-01T10:00:00+05:30',
        foods: [foodEntry({ name: 'dosa', calories: 180 })], // older, lowercase
      }),
    ]);
    repo.searchCommunityMeals.mockResolvedValueOnce([]);

    const out = await service.searchFoodHistory({ userId: '7', searchTerm: 'dosa' });

    // Dedup keys on lowercased trimmed name → these collapse to one entry.
    expect(out.body.myItems).toHaveLength(1);
    expect(out.body.myItems[0].calories).toBe(320);
  });
});
