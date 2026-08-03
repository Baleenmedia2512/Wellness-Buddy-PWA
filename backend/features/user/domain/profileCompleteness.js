/**
 * Profile completeness rules — pure domain helpers.
 * Mirrors frontend/src/features/user/domain/profileCompleteness.js
 */

const PLACEHOLDER_PHONE_USER_RE = /^user_\d+$/i;
const VALID_GENDERS = ['Male', 'Female'];

function emailLocalPart(email) {
  const local = String(email || '').split('@')[0]?.trim().toLowerCase();
  return local || '';
}

function usernameFromPhoneE164(phoneNumber) {
  const cleaned = String(phoneNumber || '').replace(/[^\d]/g, '');
  return cleaned ? `user_${cleaned}` : '';
}

/**
 * True when UserName was auto-generated at signup and the user has not chosen a real name.
 */
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

/**
 * Gender is satisfied from team_table.Gender or BPC bodyMetrics.gender.
 * @param {string|null|undefined} gender
 * @param {object|null|undefined} bodyMetrics
 * @returns {boolean}
 */
export function hasValidProfileGender(gender, bodyMetrics = null) {
  const fromProfile = String(gender || '').trim();
  if (VALID_GENDERS.includes(fromProfile)) return true;
  const fromCard = String(bodyMetrics?.gender || '').trim();
  return VALID_GENDERS.includes(fromCard);
}

/**
 * Profile gate fields for unified onboarding (phone is not blocking).
 * Photo is enforced on the CompleteProfile UI; when profileImage is passed,
 * a custom data-URL image is required for completeness.
 */
export function isProfileComplete({
  height,
  dietType,
  userName,
  email,
  phoneNumber,
  gender = null,
  bodyMetrics = null,
  profileImage = undefined,
}) {
  const hasHeight = typeof height === 'number' && height >= 50 && height <= 250;
  const hasDiet = typeof dietType === 'string' && dietType.trim() !== '';
  const hasEmail = typeof email === 'string' && email.trim() !== '' && email.includes('@');
  const hasName = hasValidProfileName(userName, { email, phoneNumber });
  const hasGender = hasValidProfileGender(gender, bodyMetrics);
  const hasPhoto = profileImage === undefined
    ? true
    : typeof profileImage === 'string'
      && (profileImage.startsWith('data:image/') || profileImage.startsWith('https://'));
  return !!(hasHeight && hasDiet && hasEmail && hasName && hasGender && hasPhoto);
}

export { VALID_GENDERS };
