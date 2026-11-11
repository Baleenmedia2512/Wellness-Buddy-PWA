/**
 * Community Position is a profile role.
 * The dropdown is loaded from the catalog API — do not hard-code role names here.
 */
export const COMMUNITY_POSITION_OTP_FLAG = 'ff.community-position-otp';

export function positionUsageLine(position) {
  if (!position) return '';
  const note = String(position.usageNote || '').trim();
  if (note) return note;
  const key = String(position.featureKey || '').trim();
  return key ? `Features check the key ${key}.` : '';
}
