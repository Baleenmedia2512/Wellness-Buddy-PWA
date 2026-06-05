// Pure helpers — classify the single login input as email vs phone and
// normalize to E.164. No I/O, no framework calls. Mirrors
// `backend/features/auth/domain/contactIdentifier.js`; keep the two in sync
// (changes must be mirrored — see claude.md §3.4).

// Curated set covering > 95% of expected sign-ups. Add more on demand.
export const COUNTRY_CODES = [
  { code: 'IN', dial: '+91', name: 'India', flag: '🇮🇳', maxDigits: 10 },
  { code: 'US', dial: '+1', name: 'United States', flag: '🇺🇸', maxDigits: 10 },
  { code: 'GB', dial: '+44', name: 'United Kingdom', flag: '🇬🇧', maxDigits: 10 },
  { code: 'AE', dial: '+971', name: 'UAE', flag: '🇦🇪', maxDigits: 9 },
  { code: 'AU', dial: '+61', name: 'Australia', flag: '🇦🇺', maxDigits: 9 },
  { code: 'CA', dial: '+1', name: 'Canada', flag: '🇨🇦', maxDigits: 10 },
  { code: 'SG', dial: '+65', name: 'Singapore', flag: '🇸🇬', maxDigits: 8 },
  { code: 'DE', dial: '+49', name: 'Germany', flag: '🇩🇪', maxDigits: 11 },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0]; // India

// Tight email check — intentionally NOT RFC 5322 perfect; matches what the
// backend will store (lowercased, no spaces, single @).
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/**
 * Classify a user-typed string. Rules:
 *  - contains '@'                              → 'email'
 *  - starts with '+' OR is purely digits/spaces/dashes (≥ 1 digit) → 'phone'
 *  - otherwise                                 → 'unknown' (still typing)
 */
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

/**
 * Convert (user input, country dial code) → E.164 string. Returns '' for
 * malformed input so callers can show a single uniform error.
 *
 *   normalizePhone('98765 43210', '+91') === '+919876543210'
 *   normalizePhone('+91 9876543210', '+91') === '+919876543210'
 *   normalizePhone('+14155551234', '+91') === '+14155551234'  // explicit + wins
 */
export function normalizePhone(rawInput, countryDial = DEFAULT_COUNTRY.dial) {
  const raw = String(rawInput || '').trim();
  if (!raw) return '';
  // Strip everything except + and digits
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    // User typed full international number — trust it
    return /^\+\d{8,15}$/.test(cleaned) ? cleaned : '';
  }
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const dial = String(countryDial || '').trim();
  if (!/^\+\d{1,4}$/.test(dial)) return '';
  const candidate = `${dial}${digitsOnly}`;
  return /^\+\d{8,15}$/.test(candidate) ? candidate : '';
}

export function isValidPhoneE164(e164) {
  return /^\+\d{8,15}$/.test(String(e164 || ''));
}
