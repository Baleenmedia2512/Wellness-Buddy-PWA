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

function resolveUserPhone(user) {
  return user?.phone || user?.PhoneNumber || null;
}

async function resolveDbUserId(user) {
  const fromUser = user?.id || user?.UserId;
  if (fromUser) return fromUser;

  const stored = Session.getOtpUser();
  if (stored?.id || stored?.UserId) {
    return stored.id || stored.UserId;
  }

  if (user) {
    const lookedUp = await getUserId(user);
    if (lookedUp) return lookedUp;
  }

  const storedRaw = Session.getOtpUserRaw();
  if (storedRaw) {
    try {
      const parsed = JSON.parse(storedRaw);
      if (parsed?.id || parsed?.UserId) {
        return parsed.id || parsed.UserId;
      }
      const lookedUp = await getUserId(parsed);
      if (lookedUp) return lookedUp;
    } catch {
      /* ignore */
    }
  }

  const cached = Session.getDbUserId();
  if (cached && stored) {
    const otpId = stored.id || stored.UserId;
    if (otpId && String(cached) === String(otpId)) return cached;
    return null;
  }

  return cached || null;
}

function mapCoachResponse(json) {
  const data = json?.data || {};
  const coachId = data.coachId || data.originalCoachId || null;
  const coachName = data.coachName || data.originalCoachName || null;
  return { coachId, coachName };
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
