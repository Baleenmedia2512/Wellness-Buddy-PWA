/**
 * fetchUserMacroProfile — fetch latestWeight + gender from the user profile endpoint.
 * Prefers team_table Gender; falls back to body_parameters_cards bodyMetrics.gender.
 * Supports email or userId (phone-only users without Profile KYC email).
 *
 * @returns {Promise<{ latestWeight: number|null, gender: string|null }>}
 */
import { getProfile } from '../../../user/services/user.api';

export async function fetchUserMacroProfile({ apiBaseUrl, email, userId } = {}) {
  const hasEmail = !!(email && String(email).trim());
  const hasUserId = userId != null && String(userId).trim() !== '';
  if (!hasEmail && !hasUserId) return { latestWeight: null, gender: null };
  try {
    void apiBaseUrl;
    const data = await getProfile(
      hasEmail ? { email: String(email).trim() } : { userId },
    );
    if (!data.success || !data.data) return { latestWeight: null, gender: null };

    let latestWeight = null;
    if (data.data.latestWeight) {
      const w = parseFloat(data.data.latestWeight);
      latestWeight = Number.isFinite(w) && w > 0 ? w : null;
    }

    const fromProfile = data.data.gender && String(data.data.gender).trim()
      ? String(data.data.gender).trim()
      : null;
    const fromCard = data.data.bodyMetrics?.gender && String(data.data.bodyMetrics.gender).trim()
      ? String(data.data.bodyMetrics.gender).trim()
      : null;
    const gender = fromProfile || fromCard;

    return { latestWeight, gender };
  } catch {
    return { latestWeight: null, gender: null };
  }
}

/**
 * @deprecated Prefer fetchUserMacroProfile — kept for callers that only need weight.
 */
export async function fetchUserLatestWeight({ apiBaseUrl, email, userId } = {}) {
  const { latestWeight } = await fetchUserMacroProfile({ apiBaseUrl, email, userId });
  return latestWeight;
}
