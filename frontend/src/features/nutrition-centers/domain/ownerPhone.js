/** Longest-first so +91 is not mistaken for +1 */
const KNOWN_COUNTRY_CODES = ['+971', '+966', '+91', '+86', '+81', '+65', '+61', '+60', '+44', '+1'];

/**
 * Split stored owner_phone (+CC + national digits) for the edit form.
 * @param {string|null|undefined} storedPhone
 * @returns {{ countryCode: string, phone: string }}
 */
export function splitOwnerPhone(storedPhone) {
  const raw = String(storedPhone || '').trim();
  if (!raw) return { countryCode: '+91', phone: '' };
  const matchedCode = KNOWN_COUNTRY_CODES.find((c) => raw.startsWith(c));
  if (matchedCode) {
    return { countryCode: matchedCode, phone: raw.slice(matchedCode.length) };
  }
  return { countryCode: '+91', phone: raw.replace(/\D/g, '') };
}
