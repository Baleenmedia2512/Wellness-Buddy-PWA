/**
 * Sync team_table.timezone_iana from the authenticated client's device timezone.
 * No-op when stored value already matches the resolved device timezone.
 */
import logger from '../../shared/lib/logger.js';
import * as repo from './user.repository.js';
import { resolveProfileTimezone } from './domain/profileTimezone.js';
import {
  hasDeviceTimezoneInput,
  resolveDeviceTimezoneIana,
} from './domain/deviceTimezone.js';

/**
 * @param {string|number} userId
 * @param {unknown} rawTimezoneIana - Client device timezone; skipped when not sent.
 * @returns {Promise<{ changed: boolean, timezoneIana?: string, from?: string, to?: string }>}
 */
export async function syncUserTimezoneIfChanged(userId, rawTimezoneIana) {
  if (!hasDeviceTimezoneInput(rawTimezoneIana)) {
    return { changed: false };
  }

  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    return { changed: false };
  }

  const resolved = resolveDeviceTimezoneIana(rawTimezoneIana);
  const row = await repo.findByUserId(uid, 'timezone_iana');
  if (!row) {
    return { changed: false };
  }

  const currentEffective = resolveProfileTimezone(row.timezone_iana);
  if (currentEffective === resolved) {
    return { changed: false, timezoneIana: resolved };
  }

  await repo.updateUserById(uid, { timezone_iana: resolved });

  logger.info('User timezone changed', {
    userId: uid,
    from: currentEffective,
    to: resolved,
  });

  return { changed: true, from: currentEffective, to: resolved, timezoneIana: resolved };
}
