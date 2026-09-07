/**
 * Admin activity time-window configuration (platform-wide).
 * Used by Wellness Score Setup and Activity Time Report settings.
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import {
  ACTIVITY_TIME_WINDOW_TYPES,
  DEFAULT_ACTIVITY_TIME_WINDOWS,
} from '../../shared/lib/activity-time-windows.js';
import * as userRepo from '../user/user.repository.js';

const REQUESTER_COLUMNS = '"UserId", "Role", "Email"';
const ADMIN_ROLES = new Set(['admin', 'developer']);

async function resolveRequester({ requesterUserId, requesterEmail }) {
  if (requesterEmail) {
    const byEmail = await userRepo.findByEmail(requesterEmail, REQUESTER_COLUMNS);
    if (byEmail) return byEmail;
  }
  if (requesterUserId != null && requesterUserId !== '') {
    const byId = await userRepo.findByUserId(requesterUserId, REQUESTER_COLUMNS);
    if (byId) return byId;
  }
  return null;
}

function assertTimeWindowsAdmin(userRow) {
  const role = String(userRow?.Role || '').toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    throw new ValidationError(
      403,
      'Activity time window settings are restricted to admin and developer roles.',
    );
  }
}

async function requireAdminRequester({ requesterUserId, requesterEmail }) {
  if (
    (requesterUserId == null || requesterUserId === '')
    && !requesterEmail
  ) {
    throw new ValidationError(400, 'requesterUserId or requesterEmail is required');
  }
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertTimeWindowsAdmin(requester);
  return requester;
}

function normalizeTimeToHhMmSs(value) {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
  if (!timeRegex.test(value)) {
    throw new ValidationError(400, 'Invalid time format. Use HH:MM or HH:MM:SS');
  }
  return value.length === 5 ? `${value}:00` : value;
}

function toAdminRow(activityType, start, end, meta = {}) {
  return {
    ActivityType: activityType,
    WindowStartTime: start,
    WindowEndTime: end,
    EffectiveFromDate: meta.EffectiveFromDate ?? null,
    EffectiveToDate: null,
    ChangedBy: meta.ChangedBy ?? null,
    ChangeReason: meta.ChangeReason ?? null,
    CreatedAt: meta.CreatedAt ?? null,
    LastUpdated: meta.CreatedAt ?? meta.LastUpdated ?? null,
    isDefault: Boolean(meta.isDefault),
  };
}

/**
 * GET current active windows (defaults filled when a type has no DB row).
 */
export async function listAdminTimeWindows({ requesterUserId, requesterEmail }) {
  await requireAdminRequester({ requesterUserId, requesterEmail });

  const supabase = getSupabaseClient();
  const { data: rows, error } = await supabase
    .from('activity_time_windows_table')
    .select('ActivityType, WindowStartTime, WindowEndTime, EffectiveFromDate, EffectiveToDate, ChangedBy, ChangeReason, CreatedAt')
    .is('EffectiveToDate', null)
    .order('ActivityType');

  if (error) {
    console.error('Error fetching time windows:', error);
    throw new ValidationError(500, 'Failed to fetch time windows');
  }

  const byType = new Map((rows || []).map((row) => [row.ActivityType, row]));
  const timeWindows = ACTIVITY_TIME_WINDOW_TYPES.map((type) => {
    const row = byType.get(type);
    if (row) {
      return toAdminRow(type, row.WindowStartTime, row.WindowEndTime, {
        ...row,
        isDefault: false,
      });
    }
    const fallback = DEFAULT_ACTIVITY_TIME_WINDOWS[type];
    return toAdminRow(type, fallback.start, fallback.end, { isDefault: true });
  });

  return {
    httpStatus: 200,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    body: { success: true, timeWindows },
  };
}

/**
 * POST versioned update for one activity type.
 */
export async function updateAdminTimeWindow({
  requesterUserId,
  requesterEmail,
  activityType,
  windowStartTime,
  windowEndTime,
  effectiveFromDate,
  changeReason,
}) {
  const requester = await requireAdminRequester({ requesterUserId, requesterEmail });

  if (!activityType || !windowStartTime || !windowEndTime || !effectiveFromDate) {
    throw new ValidationError(400, 'Missing required fields');
  }

  if (!ACTIVITY_TIME_WINDOW_TYPES.includes(activityType)) {
    throw new ValidationError(400, 'Invalid activity type');
  }

  const startTime = normalizeTimeToHhMmSs(windowStartTime);
  const endTime = normalizeTimeToHhMmSs(windowEndTime);

  if (startTime === endTime) {
    throw new ValidationError(400, 'Start time cannot be the same as end time');
  }
  if (startTime >= endTime) {
    throw new ValidationError(400, 'End time must be later than start time');
  }

  const supabase = getSupabaseClient();

  // Meal windows must not overlap each other.
  if (['breakfast', 'lunch', 'dinner'].includes(activityType)) {
    const { data: existingWindows, error: existingError } = await supabase
      .from('activity_time_windows_table')
      .select('ActivityType, WindowStartTime, WindowEndTime')
      .is('EffectiveToDate', null)
      .in('ActivityType', ['breakfast', 'lunch', 'dinner'])
      .neq('ActivityType', activityType);

    if (existingError) {
      console.error('Error checking existing windows:', existingError);
      throw new ValidationError(500, 'Failed to validate meal window overlap');
    }

    for (const existing of (existingWindows || [])) {
      const existingStart = existing.WindowStartTime;
      const existingEnd = existing.WindowEndTime;
      if (startTime < existingEnd && endTime > existingStart) {
        const err = new ValidationError(400, 'Time window overlaps with existing meal window');
        err.details = {
          conflictsWith: existing.ActivityType,
          existingWindow: `${existingStart} - ${existingEnd}`,
          requestedWindow: `${startTime} - ${endTime}`,
        };
        throw err;
      }
    }
  }

  const { error: updateError } = await supabase
    .from('activity_time_windows_table')
    .update({ EffectiveToDate: effectiveFromDate })
    .eq('ActivityType', activityType)
    .is('EffectiveToDate', null);

  if (updateError) {
    console.error('Error closing previous window:', updateError);
    throw new ValidationError(500, 'Failed to close previous time window');
  }

  const changedBy = requester.Email || String(requester.UserId);
  const currentTime = nowUtc();
  const { data: insertResult, error: insertError } = await supabase
    .from('activity_time_windows_table')
    .insert({
      ActivityType: activityType,
      WindowStartTime: startTime,
      WindowEndTime: endTime,
      EffectiveFromDate: effectiveFromDate,
      ChangedBy: changedBy,
      ChangeReason: changeReason || null,
      CreatedAt: currentTime,
    })
    .select('Id')
    .single();

  if (insertError) {
    console.error('Error inserting new window:', insertError);
    throw new ValidationError(500, 'Failed to save time window');
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Activity time windows updated successfully.',
      newWindowId: insertResult?.Id,
    },
  };
}
