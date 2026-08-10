/**
 * Profile completeness rules — pure domain helpers.
 * Mirrors backend/features/user/domain/profileCompleteness.js
 */

const PLACEHOLDER_PHONE_USER_RE = /^user_\d+$/i;
export const VALID_GENDERS = ['Male', 'Female'];
export const MIN_BODY_FAT_PCT = 1;
export const MAX_BODY_FAT_PCT = 70;

function emailLocalPart(email) {
  const local = String(email || '').split('@')[0]?.trim().toLowerCase();
  return local || '';
}

function usernameFromPhoneE164(phoneNumber) {
  const cleaned = String(phoneNumber || '').replace(/[^\d]/g, '');
  return cleaned ? `user_${cleaned}` : '';
}

export function isPlaceholderUserName(userName, { email, phoneNumber } = {}) {
  const name = String(userName || '').trim();
  if (!name) return true;
  if (PLACEHOLDER_PHONE_USER_RE.test(name)) return true;

  const emailLocal = emailLocalPart(email);
  if (emailLocal && name.toLowerCase() === emailLocal) return true;

  const fromPhone = usernameFromPhoneE164(phoneNumber);
  if (fromPhone && name.toLowerCase() === fromPhone.toLowerCase()) return true;

  return false;
}

export function hasValidProfileName(userName, context = {}) {
  const name = String(userName || '').trim();
  return name.length > 0 && !isPlaceholderUserName(userName, context);
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

export function isProfileComplete({
  height,
  dietType,
  userName,
  email,
  phoneNumber,
  gender = null,
  bodyMetrics = null,
  profileImage = undefined,
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
  const hasPhoto = profileImage === undefined
    ? true
    : typeof profileImage === 'string'
      && (profileImage.startsWith('data:image/') || profileImage.startsWith('https://'));
  return !!(hasHeight && hasDiet && hasEmail && hasName && hasGender && hasBodyFat && hasPhoto);
}
