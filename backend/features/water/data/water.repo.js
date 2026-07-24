/**
 * backend/features/water/data/water.repo.js
 * ---------------------------------------------------------------------------
 * Data-access layer for the water feature. Only this file may talk to
 * Supabase. Domain and api layers consume the returned plain objects.
 *
 * Per claude.md §2.2 / §8.3:
 *   - parameterised queries only
 *   - structured logger, never console.log
 * ---------------------------------------------------------------------------
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import logger from '../../../shared/lib/logger.js';
import { applyDayFilterWidened } from '../../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST, filterRowsByCalendarDay } from '../../../shared/lib/datetime/index.js';

/**
 * Returns the user's most-recent non-deleted weight row, or null.
 * @param {string|number} userId
 * @returns {Promise<{ Weight: number|string, CreatedAt: string } | null>}
 */
export async function getLatestWeight(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('Weight, CreatedAt')
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
  const supabase = getSupabaseClient();
  let query = supabase
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
  return filterRowsByCalendarDay(data || [], date, timezoneIana, 'CreatedAt');
}



