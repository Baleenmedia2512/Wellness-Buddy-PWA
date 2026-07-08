/**
 * Fetches active-coach info for inactive account reactivation.
 * Falls back to originalCoachId / originalCoachName when the upline chain
 * has no currently Active coach.
 */
import { getUserId } from '../../../shared/services/userIdentity';
import * as Session from '../../../shared/services/sessionStorage';

function resolveUserEmail(user) {
  return (
    user?.email ||
    user?.Email ||
    Session.getUserEmail() ||
    null
  );
}

async function resolveDbUserId(user) {
  const cached = Session.getDbUserId();
  if (cached) return cached;

  const fromUser = user?.id || user?.UserId;
  if (fromUser) return fromUser;

  if (user) {
    const lookedUp = await getUserId(user);
    if (lookedUp) return lookedUp;
  }

  const storedRaw = Session.getOtpUserRaw();
  if (storedRaw) {
    try {
      const stored = JSON.parse(storedRaw);
      if (stored?.id || stored?.UserId) {
        return stored.id || stored.UserId;
      }
      const lookedUp = await getUserId(stored);
      if (lookedUp) return lookedUp;
    } catch {
      /* ignore */
    }
  }

  return null;
}

function mapCoachResponse(json) {
  const data = json?.data || {};
  const coachId = data.coachId || data.originalCoachId || null;
  const coachName = data.coachName || data.originalCoachName || null;
  return { coachId, coachName };
}

/**
 * @param {{ apiBaseUrl: string, user?: object|null }} params
 * @returns {Promise<{ coachId: string|number|null, coachName: string|null }>}
 */
export async function fetchInactiveCoachInfo({ apiBaseUrl, user }) {
  if (!apiBaseUrl) return { coachId: null, coachName: null };

  const userId = await resolveDbUserId(user);
  const email = resolveUserEmail(user);

  if (!userId && !email) {
    return { coachId: null, coachName: null };
  }

  const query = userId
    ? `userId=${encodeURIComponent(userId)}`
    : `email=${encodeURIComponent(email)}`;

  try {
    const res = await fetch(`${apiBaseUrl}/api/user/get-active-coach?${query}`);
    const json = await res.json();
    if (!res.ok || !json?.ok) {
      return { coachId: null, coachName: null };
    }
    return mapCoachResponse(json);
  } catch {
    return { coachId: null, coachName: null };
  }
}
