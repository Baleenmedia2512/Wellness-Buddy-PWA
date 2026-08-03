/**
 * backend/features/water/api/intake.handler.js
 */
import * as repo from '../data/water.repo.js';
import { computeDailyIntake } from '../domain/intake.rules.js';
import { getUserTimezoneIana } from '../../user/domain/userTimezone.js';
import {
  resolveRequestedDateYmd,
  assertNotFutureDateYmd,
} from '../../../shared/lib/datetime/index.js';

/**
 * @param {{ userId: string, date: string|null }} input
 * @returns {Promise<{ httpStatus: 200, body: object }>}
 */
export async function getIntake({ userId, date }) {
  const timezoneIana = await getUserTimezoneIana(userId);
  const resolvedDate = resolveRequestedDateYmd(date, timezoneIana);
  assertNotFutureDateYmd(resolvedDate, timezoneIana);

  const [weightRow, foodRows] = await Promise.all([
    repo.getLatestWeight(userId),
    repo.getFoodRowsForDate(userId, resolvedDate, timezoneIana),
  ]);

  const body = computeDailyIntake({
    userId,
    date: resolvedDate,
    latestWeightKg: weightRow ? weightRow.Weight : null,
    foodRows,
  });

  return { httpStatus: 200, body };
}
