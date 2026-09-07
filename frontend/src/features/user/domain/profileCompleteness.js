/**
 * Profile completeness rules — pure domain helpers.
 * Mirrors backend/features/user/domain/profileCompleteness.js
 */

const PLACEHOLDER_PHONE_USER_RE = /^user_\d+$/i;
export const VALID_GENDERS = ['Male', 'Female'];
export const MIN_BODY_FAT_PCT = 1;
export const MAX_BODY_FAT_PCT = 70;

function usernameFromPhoneE164(phoneNumber) {
  const cleaned = String(phoneNumber || '').replace(/[^\d]/g, '');
  return cleaned ? `user_${cleaned}` : '';
}

/**
 * True when UserName was auto-generated at signup and the user has not chosen a real name.
 * Phone OTP may set `user_<digits>`; empty names are also treated as incomplete.
 * Matching an email local-part is NOT a placeholder — people often use name@gmail.com.
 */
export function isPlaceholderUserName(userName, { phoneNumber } = {}) {
  const name = String(userName || '').trim();
  if (!name) return true;
  if (PLACEHOLDER_PHONE_USER_RE.test(name)) return true;

  const fromPhone = usernameFromPhoneE164(phoneNumber);
  if (fromPhone && name.toLowerCase() === fromPhone.toLowerCase()) return true;

  return false;
}

export function hasValidProfileName(userName, context = {}) {
  const name = String(userName || '').trim();
  return name.length > 0 && !isPlaceholderUserName(userName, context);
}

/**
 * First onboarding gate (new app): real name plus a verified email.
 * Backend `needsName` stays name-only so older app binaries are not blocked.
 * @param {{ userName?: string|null, email?: string|null, phoneNumber?: string|null }} input
 * @returns {boolean}
 */
export function isOnboardingIdentityComplete({
  userName,
  email,
  phoneNumber,
} = {}) {
  const hasEmail = typeof email === 'string' && email.includes('@');
  return hasValidProfileName(userName, { email, phoneNumber }) && hasEmail;
}

export function hasValidProfileGender(gender, bodyMetrics = null) {
  const fromProfile = String(gender || '').trim();
  if (VALID_GENDERS.includes(fromProfile)) return true;
  const fromCard = String(bodyMetrics?.gender || '').trim();
  return VALID_GENDERS.includes(fromCard);
}

export function hasValidBodyFatPercent(value) {
  if (value === undefined || value === null || value === '') return false;
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= MIN_BODY_FAT_PCT && n <= MAX_BODY_FAT_PCT;
}

/**
 * Body fat is satisfied from weight_records_table.BodyFat or BPC fat%.
 * Users who already have any source are not prompted again.
 * `bodyFat` is an alias for weight BodyFat (API / form payload).
 */
export function hasValidBodyFatSource({
  bodyFat = null,
  latestWeightBodyFat = null,
  bodyMetrics = null,
} = {}) {
  if (hasValidBodyFatPercent(bodyFat)) return true;
  if (hasValidBodyFatPercent(latestWeightBodyFat)) return true;
  if (hasValidBodyFatPercent(bodyMetrics?.fatPercent)) return true;
  return false;
}

/**
 * Field completeness for remaining-profile onboarding.
 * Avatar is Centre transformation photo (separate step) — not required here.
 */
export function isProfileComplete({
  height,
  dietType,
  userName,
  email,
  phoneNumber,
  gender = null,
  bodyMetrics = null,
  profileImage: _profileImage = undefined,
  bodyFat = null,
  latestWeightBodyFat = null,
  bodyFatRequired = true,
}) {
  const hasHeight = typeof height === 'number' && height >= 50 && height <= 250;
  const hasDiet = typeof dietType === 'string' && dietType.trim() !== '';
  const hasEmail = typeof email === 'string' && email.trim() !== '' && email.includes('@');
  const hasName = hasValidProfileName(userName, { email, phoneNumber });
  const hasGender = hasValidProfileGender(gender, bodyMetrics);
  const hasBodyFat = !bodyFatRequired
    || hasValidBodyFatSource({ bodyFat, latestWeightBodyFat, bodyMetrics });
  return !!(hasHeight && hasDiet && hasEmail && hasName && hasGender && hasBodyFat);
}
