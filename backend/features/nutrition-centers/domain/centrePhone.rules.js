/**
 * OTP for a centre phone that is not the member's own login number.
 * The account number is already verified. A different number must be confirmed
 * by SMS before the new registration form can save it.
 * Apps below 3.5.7 that omit opening hours keep the old save-any-phone path.
 */
import { phonesMatch } from '../../auth/domain/phone-identity.rules.js';
import { centreApprovalExpiryIst, centreRegisterNeedsCoachApproval } from './centreApproval.rules.js';

export const CENTRE_PHONE_CONTACT_TYPE = 'centre_phone';
export const CENTRE_PHONE_TTL_MINUTES = 10;

export function centrePhoneRecipientKey(userId, phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return `centre-phone:${Number(userId)}:${digits}`;
}

export function centrePhoneExpiryIst() {
  return centreApprovalExpiryIst(CENTRE_PHONE_TTL_MINUTES);
}

/**
 * @param {{ ownerPhone?: string|null, accountPhone?: string|null, savedPhone?: string|null, appVersion?: string|null, openingHours?: object|null }} input
 */
export function centrePhoneNeedsVerification(input) {
  const phone = String(input?.ownerPhone || '').trim();
  if (!phone) return false;
  if (phonesMatch(phone, input?.accountPhone)) return false;
  if (input?.savedPhone && phonesMatch(phone, input.savedPhone)) return false;
  return centreRegisterNeedsCoachApproval({
    appVersion: input?.appVersion,
    openingHours: input?.openingHours,
  });
}
