/**
 * lookup.service.js — User feature: POST /api/user/lookup.
 *
 * Resolves a user by email and auto-deactivates accounts inactive for >= 31
 * days. Preserves response shape byte-identical to the legacy handler.
 */
import * as repo from './user.repository.js';

const INACTIVITY_DAYS = 31;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function lookupUser({ email }) {
  const user = await repo.findByEmail(
    email,
    '"UserId", "UserName", "Email", "Status", "Role", "LastActiveAt", "EntryDateTime"',
  );
  if (!user) {
    return { httpStatus: 404, body: { success: false, message: 'User not found', userNotFound: true } };
  }

  if (user.Status === 'Active') {
    const lastActivityStr = user.LastActiveAt || user.EntryDateTime;
    if (lastActivityStr) {
      const diffDays = (Date.now() - new Date(lastActivityStr).getTime()) / MS_PER_DAY;
      if (diffDays >= INACTIVITY_DAYS) {
        await repo.setUserStatus(user.UserId, 'Inactive');
        user.Status = 'Inactive';
      }
    }
  }

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
