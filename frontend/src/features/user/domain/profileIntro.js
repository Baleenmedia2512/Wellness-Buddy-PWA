/**
 * Profile introduction limits. Matches backend/features/user/domain/profileIntro.rules.js.
 * About me is 500 characters. Qualification is 250 characters.
 */
import { WORLD_LANGUAGES } from './worldLanguages';

export const PROFESSIONAL_TITLE_MAX = 80;
export const ABOUT_ME_MAX = 500;
export const QUALIFICATION_MAX = 250;
export const SOCIAL_URL_MAX = 255;

/** Digits only. A slash date keeps day, month, and year apart. Eight digits become dd/mm/yyyy. */
export function formatHerbalifeDateInput(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (text.includes('/')) {
    const [d = '', m = '', y = ''] = text.split('/');
    const day = d.replace(/\D/g, '').slice(0, 2);
    const month = m.replace(/\D/g, '').slice(0, 2);
    const year = y.replace(/\D/g, '').slice(0, 4);
    if (!month && !year) return day;
    if (!year) return month ? `${day}/${month}` : day;
    return `${day}/${month}/${year}`;
  }
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function splitHerbalifeDate(raw) {
  const formatted = formatHerbalifeDateInput(raw);
  const [day = '', month = '', year = ''] = formatted.split('/');
  return { day, month, year };
}

/** dd/mm/yyyy → yyyy-MM-dd for `<input type="date">`. Incomplete dates return ''. */
export function herbalifeDateToIso(raw) {
  const text = String(raw ?? '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const { day, month, year } = splitHerbalifeDate(text);
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return '';
  return `${year}-${month}-${day}`;
}

/** yyyy-MM-dd → dd/mm/yyyy for profile storage. */
export function isoToHerbalifeDate(iso) {
  const match = String(iso ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Today as yyyy-MM-dd in IST (UTC+5:30), matching backend join-date max. */
export function herbalifeDateMaxIso(now = new Date()) {
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

const SOCIAL_HOSTS = {
  instagram: ['instagram.com'],
  youtube: ['youtube.com', 'youtu.be'],
  linkedin: ['linkedin.com'],
};

const KNOWN_CODES = new Set(WORLD_LANGUAGES.map((item) => item.code));

function hostAllowed(raw, kind) {
  const text = String(raw ?? '').trim();
  if (!text) return true;
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (withScheme.length > SOCIAL_URL_MAX) return false;
  try {
    const url = new URL(withScheme);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    return (SOCIAL_HOSTS[kind] || []).some((name) => host === name || host.endsWith(`.${name}`));
  } catch {
    return false;
  }
}

export function validateProfileIntro(values = {}, keys = PROFILE_INTRO_KEYS) {
  const ask = (key) => !keys || keys.includes(key);
  if (ask('professionalTitle') && String(values.professionalTitle || '').trim().length > PROFESSIONAL_TITLE_MAX) {
    return `Professional title can be up to ${PROFESSIONAL_TITLE_MAX} characters.`;
  }
  if (ask('instagram') && !hostAllowed(values.instagram, 'instagram')) {
    return 'Enter an Instagram link, such as https://instagram.com/your-name.';
  }
  if (ask('youtube') && !hostAllowed(values.youtube, 'youtube')) {
    return 'Enter a YouTube link, such as https://youtube.com/@your-channel.';
  }
  if (ask('linkedin') && !hostAllowed(values.linkedin, 'linkedin')) {
    return 'Enter a LinkedIn link, such as https://linkedin.com/in/your-name.';
  }
  if (ask('herbalifeJoinedOn')) {
    const text = formatHerbalifeDateInput(values.herbalifeJoinedOn);
    if (text && !/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
      return 'Enter the Herbalife joining date as dd/mm/yyyy.';
    }
  }
  if (ask('aboutMe') && String(values.aboutMe || '').trim().length > ABOUT_ME_MAX) {
    return `About me can be up to ${ABOUT_ME_MAX} characters.`;
  }
  if (ask('qualification') && String(values.qualification || '').trim().length > QUALIFICATION_MAX) {
    return `Qualification can be up to ${QUALIFICATION_MAX} characters.`;
  }
  if (ask('languages')) {
    const codes = Array.isArray(values.languages) ? values.languages : [];
    if (codes.some((code) => !KNOWN_CODES.has(String(code)))) return 'Choose a language from the list.';
  }
  return '';
}

export function introPayload(values = {}, keys = PROFILE_INTRO_KEYS) {
  const body = {};
  const ask = (key) => !keys || keys.includes(key);
  if (ask('professionalTitle')) body.professionalTitle = String(values.professionalTitle || '').trim();
  if (ask('instagram')) body.instagram = String(values.instagram || '').trim();
  if (ask('youtube')) body.youtube = String(values.youtube || '').trim();
  if (ask('linkedin')) body.linkedin = String(values.linkedin || '').trim();
  if (ask('herbalifeJoinedOn')) body.herbalifeJoinedOn = formatHerbalifeDateInput(values.herbalifeJoinedOn);
  if (ask('aboutMe')) body.aboutMe = String(values.aboutMe || '').trim();
  if (ask('qualification')) body.qualification = String(values.qualification || '').trim();
  if (ask('languages')) body.languages = Array.isArray(values.languages) ? values.languages : [];
  return body;
}
