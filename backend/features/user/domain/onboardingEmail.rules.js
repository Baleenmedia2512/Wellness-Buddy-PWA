/**
 * Onboarding email ownership rules (pure — no I/O).
 *
 * Phone signup can attach a new email after OTP, or recover an existing
 * email-account when the user changed phone numbers.
 */

export const EMAIL_TAKEN_ADOPT_MESSAGE =
  'This email already has an account. Do you want to use it?';

export const ONBOARDING_EMAIL_OTP_MINUTES = 5;

/**
 * @param {{ currentUserId: number, emailOwnerUserId?: number|null, adoptExisting?: boolean }} input
 * @returns {{ action: 'ASSIGN'|'ALREADY_OWNED'|'OFFER_ADOPT'|'ADOPT', code?: string, message?: string }}
 */
export function decideOnboardingEmailAction({
  currentUserId,
  emailOwnerUserId = null,
  adoptExisting = false,
} = {}) {
  const currentId = Number(currentUserId);
  const ownerId = emailOwnerUserId == null || emailOwnerUserId === ''
    ? null
    : Number(emailOwnerUserId);

  if (!Number.isFinite(currentId) || currentId < 1) {
    return { action: 'ASSIGN' };
  }

  if (ownerId == null || !Number.isFinite(ownerId) || ownerId < 1) {
    return { action: 'ASSIGN' };
  }

  if (ownerId === currentId) {
    return { action: 'ALREADY_OWNED' };
  }

  if (adoptExisting === true) {
    return { action: 'ADOPT' };
  }

  return {
    action: 'OFFER_ADOPT',
    code: 'EMAIL_TAKEN',
    message: EMAIL_TAKEN_ADOPT_MESSAGE,
  };
}

function normalizePhone(raw) {
  const trimmed = String(raw || '').trim();
  return trimmed || '';
}

/**
 * How to move the newly verified phone onto the recovered email account.
 * Clears the stub user's phone first so the unique PhoneNumber constraint holds.
 *
 * @param {{ newPhone?: string|null, existingPhone?: string|null }} input
 * @returns {{ ok: true, samePhone: boolean } | { ok: false, message: string }}
 */
export function planAdoptPhoneTransfer({ newPhone, existingPhone } = {}) {
  const next = normalizePhone(newPhone);
  if (!next) {
    return {
      ok: false,
      message: 'Your phone number is missing. Sign in with your new number again.',
    };
  }
  const previous = normalizePhone(existingPhone);
  return {
    ok: true,
    samePhone: previous !== '' && previous === next,
  };
}
