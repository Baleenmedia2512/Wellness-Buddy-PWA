/**
 * Community ID input rules — mirrors backend/features/user/user.validators.js
 * (letters + numbers, max 100). Empty/whitespace clears the field.
 */
export const COMMUNITY_ID_MAX_LENGTH = 100;
const COMMUNITY_ID_PATTERN = /^[a-zA-Z0-9]+$/;

export function normalizeCommunityId(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  return trimmed === '' ? null : trimmed;
}

export function validateCommunityId(raw) {
  const normalized = normalizeCommunityId(raw);
  if (normalized === null) return { valid: true, value: null };
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
export function sanitizeCommunityIdInput(raw) {
  return String(raw || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, COMMUNITY_ID_MAX_LENGTH);
}
