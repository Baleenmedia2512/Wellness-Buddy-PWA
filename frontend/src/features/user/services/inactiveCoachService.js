/**
 * Fetches coach info for inactive account reactivation.
 * Shows the user's direct coach when active; only falls back to the upline
 * coach when the direct coach is inactive.
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

function resolveUserPhone(user) {
  return user?.phone || user?.PhoneNumber || null;
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
  const directCoachActive =
    data.isOriginalCoach === true || data.originalCoachStatus === 'Active';

  if (directCoachActive) {
    return {
      coachId: data.contactCoachId || data.originalCoachId || data.coachId || null,
      coachName: data.contactCoachName || data.originalCoachName || data.coachName || null,
    };
  }

  return {
    coachId: data.contactCoachId || data.coachId || null,
    coachName: data.contactCoachName || data.coachName || null,
  };
}

async function fetchCoachByQuery(apiBaseUrl, query) {
  const res = await fetch(`${apiBaseUrl}/api/user/get-active-coach?${query}`);
  const json = await res.json();
  if (!res.ok || !json?.ok) return null;
  return mapCoachResponse(json);
}

/**
 * @param {{ apiBaseUrl: string, user?: object|null }} params
 * @returns {Promise<{ coachId: string|number|null, coachName: string|null }>}
 */
export async function fetchInactiveCoachInfo({ apiBaseUrl, user }) {
  if (!apiBaseUrl) return { coachId: null, coachName: null };

  const userId = await resolveDbUserId(user);
  const email = resolveUserEmail(user);
  const phone = resolveUserPhone(user);

  if (!userId && !email && !phone) {
    return { coachId: null, coachName: null };
  }

  const attempts = [];
  if (userId) attempts.push(`userId=${encodeURIComponent(userId)}`);
  if (email) attempts.push(`email=${encodeURIComponent(email)}`);
  if (phone) attempts.push(`phone=${encodeURIComponent(phone)}`);

  try {
    for (const query of attempts) {
      const result = await fetchCoachByQuery(apiBaseUrl, query);
      if (result?.coachId || result?.coachName) return result;
    }
    if (attempts.length > 0) {
      const last = await fetchCoachByQuery(apiBaseUrl, attempts[0]);
      if (last) return last;
    }
    return { coachId: null, coachName: null };
  } catch {
    return { coachId: null, coachName: null };
  }
}
