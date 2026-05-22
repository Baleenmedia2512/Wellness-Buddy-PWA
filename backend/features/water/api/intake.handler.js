/**
 * backend/features/water/api/intake.handler.js
 * ---------------------------------------------------------------------------
 * Orchestration for GET /api/water/intake.
 *
 * Responsibilities (only):
 *   1. call the data layer
 *   2. hand the rows to the pure domain function
 *   3. shape the HTTP envelope expected by `shared/lib/handler.runService`
 *
 * No business rules live here. No SQL lives here.
 * ---------------------------------------------------------------------------
 */
import * as repo from '../data/water.repo.js';
import { computeDailyIntake } from '../domain/intake.rules.js';

/**
 * @param {{ userId: string, date: string }} input  pre-validated
 * @returns {Promise<{ httpStatus: 200, body: object }>}
 */
export async function getIntake({ userId, date }) {
  const [weightRow, foodRows] = await Promise.all([
    repo.getLatestWeight(userId),
    repo.getFoodRowsForDate(userId, date),
  ]);

  const body = computeDailyIntake({
    userId,
    date,
    latestWeightKg: weightRow ? weightRow.Weight : null,
    foodRows,
  });

  return { httpStatus: 200, body };
}
