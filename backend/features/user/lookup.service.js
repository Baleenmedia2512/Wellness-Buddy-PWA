/**
 * lookup.service.js — User feature: POST /api/user/lookup.
 *
 * Resolves a user by email. Idle users stay Active (ADR-0007). When an Active
 * user returns after ≥7 days idle, their coach is emailed once; Account
 * Restricted remains only for Status=Inactive (manual / legacy).
 */
import * as repo from './user.repository.js';
import { syncUserTimezoneIfChanged } from './timezone-sync.service.js';
import { notifyCoachIfReturningIdleUser } from '../idle-cleanup/api/return-notify.service.js';

export async function lookupUser({ email, timezoneIana }) {
  const user = await repo.findByEmail(
    email,
    '"UserId", "UserName", "Email", "Status", "Role", "LastActiveAt", "EntryDateTime"',
  );
  if (!user) {
    return { httpStatus: 404, body: { success: false, message: 'User not found', userNotFound: true } };
  }

  // Active + idle ≥7d → coach email (non-blocking). Never auto-set Inactive.
  if (user.Status === 'Active') {
    const lastActivityStr = user.LastActiveAt || user.EntryDateTime;
    try {
      await notifyCoachIfReturningIdleUser({
        userId: user.UserId,
        lastActiveAt: lastActivityStr,
      });
    } catch {
      /* notify service already fail-soft; never break lookup */
    }
  }

  await syncUserTimezoneIfChanged(user.UserId, timezoneIana);

  return {
    httpStatus: 200,
    body: {
      success: true,
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      status: user.Status,
      isActive: user.Status === 'Active',
      role: user.Role || 'user',
    },
  };
}
