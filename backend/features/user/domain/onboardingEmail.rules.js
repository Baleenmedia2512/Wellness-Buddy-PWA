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

/**
 * Build a team_table patch that copies BCM/profile metrics from a phone stub
 * onto an adopted email account only when the target field is empty.
 *
 * @param {object|null|undefined} fromRow - BCM lead / phone stub
 * @param {object|null|undefined} toRow - email account being recovered
 * @returns {object}
 */
export function buildAdoptProfileMetricsPatch(fromRow, toRow) {
  if (!fromRow || !toRow) return {};
  const patch = {};
  const copyIfEmpty = (col, isEmpty) => {
    if (fromRow[col] == null || fromRow[col] === '') return;
    if (!isEmpty(toRow[col])) return;
    patch[col] = fromRow[col];
  };

  copyIfEmpty('Height', (v) => {
    const n = v != null && v !== '' ? Number(v) : NaN;
    return !Number.isFinite(n) || n < 50;
  });
  copyIfEmpty('Bmr', (v) => v == null || v === '');
  copyIfEmpty('Gender', (v) => !v);
  copyIfEmpty('Age', (v) => v == null || v === '');
  copyIfEmpty('VisceralFat', (v) => v == null || v === '');
  copyIfEmpty('BodyAge', (v) => v == null || v === '');
  copyIfEmpty('ChestCm', (v) => v == null || v === '');
  copyIfEmpty('WaistCm', (v) => v == null || v === '');
  copyIfEmpty('HipCm', (v) => v == null || v === '');
  copyIfEmpty('DietType', (v) => !v);
  copyIfEmpty('PhysicalActivityLevel', (v) => !v);

  if (
    Array.isArray(fromRow.recovered_health_issues)
    && fromRow.recovered_health_issues.length
    && !(Array.isArray(toRow.recovered_health_issues) && toRow.recovered_health_issues.length)
  ) {
    patch.recovered_health_issues = fromRow.recovered_health_issues;
  }

  const fromPhotos = fromRow.transformation_photos;
  const toPhotos = toRow.transformation_photos;
  const toHasPhotos = toPhotos
    && typeof toPhotos === 'object'
    && (toPhotos.front || toPhotos.left || toPhotos.right);
  if (fromPhotos && typeof fromPhotos === 'object' && !toHasPhotos) {
    patch.transformation_photos = fromPhotos;
  }

  return patch;
}
