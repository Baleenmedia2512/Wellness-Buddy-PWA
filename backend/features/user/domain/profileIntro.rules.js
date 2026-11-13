/**
 * Profile introduction fields. Pure.
 * Shown on Profile. The field-collection gate asks them only after an admin
 * sets While entering or Ask later. Social links may stay blank.
 *
 * About me is 500 characters. Qualification is 250 characters.
 */

export const PROFESSIONAL_TITLE_MAX = 80;
export const ABOUT_ME_MAX = 500;
export const QUALIFICATION_MAX = 250;
export const SOCIAL_URL_MAX = 255;

export const PROFILE_INTRO_KEYS = Object.freeze([
  'professionalTitle',
  'instagram',
  'youtube',
  'linkedin',
  'herbalifeJoinedOn',
  'aboutMe',
  'qualification',
  'languages',
]);

export const PROFILE_INTRO_LABELS = Object.freeze({
  professionalTitle: 'Professional title',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  herbalifeJoinedOn: 'Date of joining Herbalife',
  aboutMe: 'About me',
  qualification: 'Qualification',
  languages: 'Languages',
});

const SOCIAL_HOSTS = Object.freeze({
  instagram: ['instagram.com'],
  youtube: ['youtube.com', 'youtu.be'],
  linkedin: ['linkedin.com'],
});

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeProfessionalTitle(raw) {
  const text = cleanText(raw);
  if (!text) return '';
  if (text.length > PROFESSIONAL_TITLE_MAX) return null;
  return text;
}

export function normalizeSocialUrl(raw, kind) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (withScheme.length > SOCIAL_URL_MAX) return null;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  const allowed = SOCIAL_HOSTS[kind] || [];
  const ok = allowed.some((name) => host === name || host.endsWith(`.${name}`));
  if (!ok) return null;
  return url.toString();
}

export function normalizeHerbalifeJoinedOn(raw, now = new Date()) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const compact = text.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!dmy && !iso && !compact) return null;
  const day = Number(dmy ? dmy[1] : (compact ? compact[1] : iso[3]));
  const month = Number(dmy ? dmy[2] : (compact ? compact[2] : iso[2]));
  const year = Number(dmy ? dmy[3] : (compact ? compact[3] : iso[1]));
  const stamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(stamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  if (year < 1980) return null;
  const today = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const todayStamp = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (stamp > todayStamp) return null;
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

export function herbalifeDateToSql(dmy) {
  if (!dmy) return null;
  const [dd, mm, yyyy] = String(dmy).split('/');
  return `${yyyy}-${mm}-${dd}`;
}

export function sqlDateToHerbalife(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const shifted = new Date(value.getTime() + (5 * 60 + 30) * 60 * 1000);
    const dd = String(shifted.getUTCDate()).padStart(2, '0');
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${shifted.getUTCFullYear()}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return normalizeHerbalifeJoinedOn(text) || '';
  return `${iso[3]}/${iso[2]}/${iso[1]}`;
}

export function normalizeAboutMe(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';
  if (text.length > ABOUT_ME_MAX) return null;
  return text;
}

export function normalizeQualification(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';
  if (text.length > QUALIFICATION_MAX) return null;
  return text;
}

export function normalizeLanguageCodes(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw ?? '').split(',');
  const codes = [];
  for (const item of list) {
    const code = String(item ?? '').trim().toLowerCase();
    if (!code) continue;
    if (!/^[a-z]{2,3}$/.test(code)) return null;
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

const SOCIAL_KIND = Object.freeze({
  instagram: 'instagram',
  youtube: 'youtube',
  linkedin: 'linkedin',
});

export function profileIntroHasValue(key, values = {}) {
  if (key === 'professionalTitle') return normalizeProfessionalTitle(values.professionalTitle) !== '' && normalizeProfessionalTitle(values.professionalTitle) != null;
  if (SOCIAL_KIND[key]) {
    const url = normalizeSocialUrl(values[key], SOCIAL_KIND[key]);
    return Boolean(url);
  }
  if (key === 'herbalifeJoinedOn') return Boolean(normalizeHerbalifeJoinedOn(values.herbalifeJoinedOn));
  if (key === 'aboutMe') return Boolean(normalizeAboutMe(values.aboutMe));
  if (key === 'qualification') return Boolean(normalizeQualification(values.qualification));
  if (key === 'languages') {
    const codes = normalizeLanguageCodes(values.languages);
    return Array.isArray(codes) && codes.length > 0;
  }
  return false;
}

const FIELD_MESSAGES = Object.freeze({
  professionalTitle: `Professional title can be up to ${PROFESSIONAL_TITLE_MAX} characters.`,
  instagram: 'Enter an Instagram link, such as https://instagram.com/your-name.',
  youtube: 'Enter a YouTube link, such as https://youtube.com/@your-channel.',
  linkedin: 'Enter a LinkedIn link, such as https://linkedin.com/in/your-name.',
  herbalifeJoinedOn: 'Enter the Herbalife joining date as dd/mm/yyyy.',
  aboutMe: `About me can be up to ${ABOUT_ME_MAX} characters.`,
  qualification: `Qualification can be up to ${QUALIFICATION_MAX} characters.`,
  languages: 'Choose a language from the list.',
});

/**
 * Normalize only the keys that were sent. Undefined means leave unchanged.
 * @returns {{ ok: true, value: object } | { ok: false, message: string }}
 */
export function normalizeProfileIntroPatch(input = {}) {
  const value = {};
  const take = (key, normalized) => {
    if (normalized == null) return FIELD_MESSAGES[key];
    value[key] = normalized;
    return '';
  };
  if (input.professionalTitle !== undefined) {
    const message = take('professionalTitle', normalizeProfessionalTitle(input.professionalTitle));
    if (message) return { ok: false, message };
  }
  for (const kind of ['instagram', 'youtube', 'linkedin']) {
    if (input[kind] === undefined) continue;
    const message = take(kind, normalizeSocialUrl(input[kind], kind));
    if (message) return { ok: false, message };
  }
  if (input.herbalifeJoinedOn !== undefined) {
    const message = take('herbalifeJoinedOn', normalizeHerbalifeJoinedOn(input.herbalifeJoinedOn));
    if (message) return { ok: false, message };
  }
  if (input.aboutMe !== undefined) {
    const message = take('aboutMe', normalizeAboutMe(input.aboutMe));
    if (message) return { ok: false, message };
  }
  if (input.qualification !== undefined) {
    const message = take('qualification', normalizeQualification(input.qualification));
    if (message) return { ok: false, message };
  }
  if (input.languages !== undefined) {
    const message = take('languages', normalizeLanguageCodes(input.languages));
    if (message) return { ok: false, message };
  }
  return { ok: true, value };
}
