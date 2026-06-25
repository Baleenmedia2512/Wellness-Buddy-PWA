/**
 * Phone identity rules for team_table.PhoneNumber (pure — no I/O).
 *
 * Legacy rows store 10-digit Indian numbers (e.g. 9876543210). Login sends E.164
 * (+919876543210). Lookup must try all equivalent forms before creating a user.
 */

/** All string forms to try when resolving team_table.PhoneNumber. */
export function buildPhoneLookupVariants(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  const variants = new Set();

  if (raw) variants.add(raw);
  if (!digits) return [];

  variants.add(digits);

  if (digits.length === 12 && digits.startsWith('91')) {
    variants.add(digits.slice(2));
    variants.add(`+${digits}`);
  }
  if (digits.length === 10) {
    variants.add(`+91${digits}`);
    variants.add(`91${digits}`);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    variants.add(digits.slice(1));
    variants.add(`+91${digits.slice(1)}`);
  }

  return [...variants].filter(Boolean);
}

/**
 * Canonical value to persist on new mobile sign-ups.
 * Indian numbers → 10-digit national (matches existing team_table data).
 */
export function canonicalPhoneForStorage(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);

  if (raw.startsWith('+')) return raw;
  return digits;
}

/** True when two inputs refer to the same handset (digit-normalized). */
export function phonesMatch(a, b) {
  const da = String(a || '').replace(/\D/g, '');
  const db = String(b || '').replace(/\D/g, '');
  if (!da || !db) return false;
  if (da === db) return true;

  const national = (d) => {
    if (d.length === 12 && d.startsWith('91')) return d.slice(2);
    if (d.length === 11 && d.startsWith('0')) return d.slice(1);
    return d;
  };

  return national(da) === national(db);
}
