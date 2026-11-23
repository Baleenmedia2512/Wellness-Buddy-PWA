/**
 * Persist the login "Enter OTP" step across mobile-web tab freezes / reloads.
 *
 * On phone browsers, switching to the SMS app often reloads the tab. otpSent
 * lived only in React state, so the OTP screen disappeared. sessionStorage
 * survives that reload for the same tab; TTL matches MDT phone OTP expiry.
 */

export const LOGIN_OTP_CHALLENGE_KEY = 'wv.loginOtpChallenge';
/** How long the Enter OTP screen is restored after a mobile-web reload. */
export const LOGIN_OTP_CHALLENGE_TTL_MS = 1 * 60 * 1000;

function browserSession() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    /* private mode */
  }
  return null;
}

/**
 * @param {object|null|undefined} raw
 * @param {number} [now]
 * @returns {object|null}
 */
export function normalizeLoginOtpChallenge(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return null;
  const phoneRecipient = String(raw.phoneRecipient || '').trim();
  const email = String(raw.email || '').trim();
  const countryDial = String(raw.countryDial || '').trim();
  const sentAt = Number(raw.sentAt);
  if (!phoneRecipient || !email || !countryDial) return null;
  if (!Number.isFinite(sentAt) || sentAt <= 0) return null;
  if (now - sentAt > LOGIN_OTP_CHALLENGE_TTL_MS) return null;
  return {
    email,
    countryDial,
    phoneRecipient,
    activeChannel: 'phone',
    termsAccepted: raw.termsAccepted === true,
    sentAt,
  };
}

/**
 * @param {Storage|null} [storage]
 * @param {number} [now]
 * @returns {object|null}
 */
export function loadLoginOtpChallenge(storage = browserSession(), now = Date.now()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LOGIN_OTP_CHALLENGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const challenge = normalizeLoginOtpChallenge(parsed, now);
    if (!challenge) {
      storage.removeItem(LOGIN_OTP_CHALLENGE_KEY);
      return null;
    }
    return challenge;
  } catch {
    try {
      storage.removeItem(LOGIN_OTP_CHALLENGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * @param {{
 *   email: string,
 *   countryDial: string,
 *   phoneRecipient: string,
 *   termsAccepted?: boolean,
 *   sentAt?: number,
 * }} challenge
 * @param {Storage|null} [storage]
 */
export function saveLoginOtpChallenge(challenge, storage = browserSession()) {
  if (!storage) return;
  const sentAt = Number(challenge?.sentAt) > 0 ? Number(challenge.sentAt) : Date.now();
  // Validate shape only at save time (use sentAt as "now" so tests/clock skew
  // cannot reject a just-written challenge). Expiry is enforced on load.
  const normalized = normalizeLoginOtpChallenge({
    ...challenge,
    sentAt,
    activeChannel: 'phone',
  }, sentAt);
  if (!normalized) return;
  try {
    storage.setItem(LOGIN_OTP_CHALLENGE_KEY, JSON.stringify(normalized));
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {Storage|null} [storage]
 */
export function clearLoginOtpChallenge(storage = browserSession()) {
  if (!storage) return;
  try {
    storage.removeItem(LOGIN_OTP_CHALLENGE_KEY);
  } catch {
    /* ignore */
  }
}
