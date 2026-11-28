/**
 * Aadhaar DOB helpers — age from DOB using IST calendar (matches backend).
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MIN_AGE = 1;
const MAX_AGE = 120;

/** Today as yyyy-MM-dd in IST. */
export function istTodayIso(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * @param {unknown} raw
 * @returns {string} yyyy-MM-dd or '' when empty/incomplete; null when invalid
 */
export function normalizeDateOfBirthIso(raw) {
  if (raw == null || String(raw).trim() === '') return '';
  const text = String(raw).trim();
  let year;
  let month;
  let day;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else {
    return null;
  }

  const stamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(stamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }

  const [ty, tm, td] = istTodayIso().split('-').map(Number);
  const todayStamp = Date.UTC(ty, tm - 1, td);
  if (stamp > todayStamp) return null;

  const age = ageFromParts(year, month, day, ty, tm, td);
  if (age < MIN_AGE || age > MAX_AGE) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function ageFromParts(by, bm, bd, ty, tm, td) {
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/**
 * @param {string|null|undefined} isoDob
 * @param {Date} [now]
 * @returns {number|null}
 */
export function ageFromDateOfBirth(isoDob, now = new Date()) {
  const iso = normalizeDateOfBirthIso(isoDob);
  if (!iso) return null;
  const [by, bm, bd] = iso.split('-').map(Number);
  const [ty, tm, td] = istTodayIso(now).split('-').map(Number);
  const age = ageFromParts(by, bm, bd, ty, tm, td);
  if (age < MIN_AGE || age > MAX_AGE) return null;
  return age;
}

export const DOB_FIELD_LABEL = 'DOB (as per Aadhaar)';
export const DOB_HINT = 'Enter the date of birth printed on your Aadhaar card.';
