/**
 * Profile completeness rules — pure domain helpers.
 * Mirrors frontend/src/features/user/domain/profileCompleteness.js
 */

const PLACEHOLDER_PHONE_USER_RE = /^user_\d+$/i;

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

export function isProfileComplete({
  height,
  dietType,
  phoneNumber,
  userName,
  email,
}) {
  const hasHeight = typeof height === 'number' && height >= 50 && height <= 250;
  const hasDiet = typeof dietType === 'string' && dietType.trim() !== '';
  const hasPhone = typeof phoneNumber === 'string' && phoneNumber.trim() !== '';
  const hasName = hasValidProfileName(userName, { email, phoneNumber });
  return !!(hasHeight && hasDiet && hasPhone && hasName);
}
