/**
 * backend/shared/lib/diaryPostLock.rules.js
 *
 * Business rule: Diary posts can only be edited or deleted on the same day
 * they were created (evaluated in the user's business timezone).
 * Posts from previous days are strictly read-only.
 */

import {
  IANA_IST,
  todayInTimezone,
  timestampToCalendarYmd,
  normalizeStoredTimestampToUtcIso,
} from './datetime/index.js';
import { getUserTimezoneIana } from '../../features/user/domain/userTimezone.js';

/**
 * Check whether a stored diary record's timestamp falls on today's calendar date
 * in the specified IANA timezone.
 *
 * @param {string|Date} createdAt - Stored CreatedAt timestamp
 * @param {string} [timezoneIana=IANA_IST] - User's IANA timezone
 * @returns {boolean} True if created today, false otherwise
 */
export function isDiaryPostToday(createdAt, timezoneIana = IANA_IST) {
  if (!createdAt) return false;
  try {
    const todayYmd = todayInTimezone(timezoneIana);
    const utcIso = normalizeStoredTimestampToUtcIso(createdAt, IANA_IST);
    const recordYmd = timestampToCalendarYmd(utcIso, timezoneIana);
    return recordYmd === todayYmd;
  } catch {
    return false;
  }
}

/**
 * Enforce that a diary post can only be edited or deleted on the day it was created.
 *
 * @param {string|Date} createdAt - Stored CreatedAt timestamp
 * @param {string|number} userId - Owner user ID
 * @param {'edit'|'delete'} [action='delete'] - Action being attempted
 * @returns {Promise<{ allowed: boolean, errorResponse?: { httpStatus: number, body: { success: boolean, ok: boolean, message: string, error: { message: string, code: string } } } }>}
 */
export async function assertDiaryPostEditableOrDeletable(createdAt, userId, action = 'delete', explicitTimezone = null) {
  let timezoneIana = explicitTimezone;
  if (!timezoneIana && userId) {
    try {
      timezoneIana = await getUserTimezoneIana(userId);
    } catch {
      timezoneIana = IANA_IST;
    }
  }
  timezoneIana = timezoneIana || IANA_IST;

  const isToday = isDiaryPostToday(createdAt, timezoneIana);
  if (!isToday) {
    const pastVerb = action === 'delete' ? 'deleted' : 'edited';
    const message = `Diary posts from previous days cannot be ${pastVerb}.`;
    return {
      allowed: false,
      errorResponse: {
        httpStatus: 403,
        body: {
          success: false,
          ok: false,
          message,
          error: { message, code: 'DIARY_POST_LOCKED' },
        },
      },
    };
  }
  return { allowed: true };
}
