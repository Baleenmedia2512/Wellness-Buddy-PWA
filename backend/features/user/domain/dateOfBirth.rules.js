/**
 * dateOfBirth.rules.js — Aadhaar DOB → age (IST calendar).
 *
 * Profile stores both DateOfBirth and Age. When DOB is present, Age is derived.
 * Older apps may still send Age alone.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MIN_AGE = 1;
const MAX_AGE = 120;

/**
 * Today as yyyy-MM-dd in IST (UTC+5:30).
 * @param {Date} [now]
 * @returns {string}
 */
export function istTodayIso(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse DOB into yyyy-MM-dd. Accepts ISO or dd/mm/yyyy.
 * @param {unknown} raw
 * @returns {string|null} null when invalid; '' when empty
 */
export function normalizeDateOfBirthIso(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return '';
  const text = String(raw).trim();
  if (!text) return '';

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

  const todayIso = istTodayIso();
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const todayStamp = Date.UTC(ty, tm - 1, td);
  if (stamp > todayStamp) return null;

  const age = ageFromDobParts(year, month, day, ty, tm, td);
  if (age < MIN_AGE || age > MAX_AGE) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * @param {number} by
 * @param {number} bm
 * @param {number} bd
 * @param {number} ty
 * @param {number} tm
 * @param {number} td
 * @returns {number}
 */
function ageFromDobParts(by, bm, bd, ty, tm, td) {
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/**
 * Age in whole years from ISO DOB, using IST "today".
 * @param {string|null|undefined} isoDob yyyy-MM-dd
 * @param {Date} [now]
 * @returns {number|null}
 */
export function ageFromDateOfBirth(isoDob, now = new Date()) {
  const iso = normalizeDateOfBirthIso(isoDob);
  if (!iso) return null;
  const [by, bm, bd] = iso.split('-').map(Number);
  const [ty, tm, td] = istTodayIso(now).split('-').map(Number);
  const age = ageFromDobParts(by, bm, bd, ty, tm, td);
  if (age < MIN_AGE || age > MAX_AGE) return null;
  return age;
}

/**
 * SQL DATE / Date / ISO string → yyyy-MM-dd for clients.
 * @param {unknown} value
 * @returns {string|null}
 */
export function sqlDateToIso(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const shifted = new Date(value.getTime() + IST_OFFSET_MS);
    const yyyy = shifted.getUTCFullYear();
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(shifted.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return null;
  return `${iso[1]}-${iso[2]}-${iso[3]}`;
}

export const DATE_OF_BIRTH_AGE_BOUNDS = Object.freeze({ min: MIN_AGE, max: MAX_AGE });
