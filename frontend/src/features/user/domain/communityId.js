/**
 * Community ID input rules — mirrors backend/features/user/user.validators.js
 * (letters + numbers, min 4 when set, max 100). Empty/whitespace clears the field.
 */
export const COMMUNITY_ID_MAX_LENGTH = 100;
export const COMMUNITY_ID_MIN_LENGTH = 4;
export const COMMUNITY_ID_PLACEHOLDER = 'W112072XXX';
const COMMUNITY_ID_PATTERN = /^[a-zA-Z0-9]+$/;

export function normalizeCommunityId(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  return trimmed === '' ? null : trimmed;
}

export function validateCommunityId(raw) {
  const normalized = normalizeCommunityId(raw);
  if (normalized === null) return { valid: true, value: null };
  if (normalized.length < COMMUNITY_ID_MIN_LENGTH) {
    return {
      valid: false,
      message: `Community ID must be at least ${COMMUNITY_ID_MIN_LENGTH} characters.`,
    };
  }
  if (normalized.length > COMMUNITY_ID_MAX_LENGTH) {
    return {
      valid: false,
      message: `Community ID must be at most ${COMMUNITY_ID_MAX_LENGTH} characters.`,
    };
  }
  if (!COMMUNITY_ID_PATTERN.test(normalized)) {
    return { valid: false, message: 'Community ID may only contain letters and numbers.' };
  }
  return { valid: true, value: normalized };
}

/** Strip characters the backend would reject, and cap length while typing. */
export function sanitizeCommunityIdInput(raw, maxLength = COMMUNITY_ID_MAX_LENGTH) {
  const cap = Number.isFinite(maxLength) && maxLength > 0
    ? maxLength
    : COMMUNITY_ID_MAX_LENGTH;
  return String(raw || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, cap);
}

/** Profile display: saved Community ID, else the Team / Community ID from onboarding. */
export function resolveDisplayCommunityId({ communityId, teamId } = {}) {
  const fromProfile = String(communityId ?? '').trim();
  if (fromProfile) return fromProfile;
  return String(teamId ?? '').trim();
}
