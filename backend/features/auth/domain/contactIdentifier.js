// Backend mirror of frontend/src/features/user/domain/contactIdentifier.js.
// Pure helpers — no I/O. Keep these two files in sync (claude.md §3.4).
// Used by validators + firebasePhoneLogin service to normalize phone strings
// pulled from Firebase ID tokens and to validate email recipients.

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function detectContactType(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'unknown';
  if (s.includes('@')) return 'email';
  if (/^\+?[\d\s\-()]+$/.test(s) && /\d/.test(s)) return 'phone';
  return 'unknown';
}

export function isValidEmail(raw) {
  return EMAIL_RE.test(String(raw || '').trim().toLowerCase());
}

export function isValidPhoneE164(e164) {
  return /^\+\d{8,15}$/.test(String(e164 || ''));
}

/**
 * Derive a stable, URL-safe username from a phone number when the user signs
 * up without an email. Strip the leading '+' so the result mirrors the
 * email-based pattern (`email.split('@')[0]`).
 */
export function usernameFromPhone(e164) {
  const cleaned = String(e164 || '').replace(/[^\d]/g, '');
  return cleaned ? `user_${cleaned}` : '';
}
