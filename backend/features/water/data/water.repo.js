/**
 * backend/features/water/data/water.repo.js
 * ---------------------------------------------------------------------------
 * Data-access layer for the water feature. Only this file may talk to
 * MySQL. Domain and api layers consume the returned plain objects.
 *
 * Per claude.md §2.2 / §8.3:
 *   - parameterised queries only
 *   - structured logger, never console.log
 * ---------------------------------------------------------------------------
 */
import { getMysqlClient } from '../../../utils/mysqlClient.js';
import logger from '../../../shared/lib/logger.js';
import { applyDayFilterWidened } from '../../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST, filterFoodRowsByCalendarDay } from '../../../shared/lib/datetime/index.js';

/**
 * Returns the user's most-recent non-deleted weight row, or null.
 * BodyFat / Bmr are included so Wellness Score can resolve Katch-McArdle BMR
 * when team_table.Bmr was never synced.
 * @param {string|number} userId
 * @returns {Promise<{ Weight: number|string, BodyFat?: number|string|null, Bmr?: number|string|null, CreatedAt: string } | null>}
 */
export async function getLatestWeight(userId) {
  const db = getMysqlClient();
  const { data, error } = await db
    .from('weight_records_table')
    .select('Weight, BodyFat, Bmr, CreatedAt')
    .eq('UserId', userId)
    .or('IsDeleted.is.null,IsDeleted.eq.0,IsDeleted.eq.false')
    .order('CreatedAt', { ascending: false })
    .limit(1);

  if (error) {
    logger.error('[water.repo] weight query failed', {
      userId,
      err: error.message,
    });
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/**
 * Returns all non-deleted food rows for the given user/date.
 * @param {string|number} userId
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<Array<{ CreatedAt: string, AnalysisData: unknown }>>}
 */
export async function getFoodRowsForDate(userId, date, timezoneIana = IANA_IST) {
  const db = getMysqlClient();
  let query = db
    .from('food_nutrition_data_table')
    .select('CreatedAt, AnalysisData')
    .eq('UserID', String(userId))
    .or('IsDeleted.is.null,IsDeleted.eq.0');
  query = applyDayFilterWidened(query, 'CreatedAt', date, timezoneIana);
  const { data, error } = await query;

  if (error) {
    logger.error('[water.repo] food query failed', {
      userId,
      date,
      err: error.message,
    });
    return [];
  }
  return filterFoodRowsByCalendarDay(data || [], date, timezoneIana, 'CreatedAt');
}



