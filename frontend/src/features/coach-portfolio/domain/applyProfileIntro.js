/**
 * Overlay Profile intro onto portfolio FormJson.
 * Empty Profile fields clear stale defaults (e.g. old "Wellness Coach").
 */

const LANGUAGE_NAME_BY_CODE = Object.freeze({
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada',
  ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi',
  ur: 'Urdu', or: 'Odia', as: 'Assamese', ne: 'Nepali', si: 'Sinhala',
  ar: 'Arabic', zh: 'Chinese', es: 'Spanish', fr: 'French', de: 'German',
});

/** Titles the old form auto-filled — treat as empty when Profile has no title. */
export function isLegacyDefaultProfessionalTitle(value) {
  const t = String(value || '').trim().toLowerCase();
  return t === 'wellness coach' || t === 'professional wellness coach';
}

/**
 * Years label from Profile Date of joining Herbalife (dd/mm/yyyy).
 * @param {string|null|undefined} herbalifeJoinedOn
 * @param {Date} [now]
 * @returns {string}
 */
export function yearsExperienceFromJoinedOn(herbalifeJoinedOn, now = new Date()) {
  const text = String(herbalifeJoinedOn || '').trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return '';
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  if (!(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 1900)) return '';
  const today = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  let years = today.getUTCFullYear() - yyyy;
  const todayMd = (today.getUTCMonth() + 1) * 100 + today.getUTCDate();
  const joinMd = mm * 100 + dd;
  if (todayMd < joinMd) years -= 1;
  if (years < 0) years = 0;
  if (years === 0) return 'Less than 1 year';
  if (years === 1) return '1 year';
  return `${years}+ years`;
}

function languageNamesFromCodes(codes) {
  if (!Array.isArray(codes) || !codes.length) return [];
  return codes
    .map((code) => {
      const key = String(code || '').trim().toLowerCase();
      return LANGUAGE_NAME_BY_CODE[key] || key;
    })
    .filter(Boolean);
}

/**
 * @param {object} form mergePortfolioForm result
 * @param {object|null|undefined} profile fetchProfile data
 * @returns {object} same form reference with personal/social updated
 */
export function applyProfileIntroToForm(form, profile) {
  if (!form?.personal) return form;
  const p = profile || {};
  const title = String(p.professionalTitle || '').trim();
  const aboutMe = String(p.aboutMe || '').trim();
  const qualification = String(p.qualification || '').trim();
  const joined = String(p.herbalifeJoinedOn || '').trim();
  const languages = languageNamesFromCodes(p.languages);

  form.personal.professionalTitle = title;
  form.personal.professionalTitleOther = '';
  form.personal.background = aboutMe;
  form.personal.qualifications = qualification;
  form.personal.yearsExperience = joined ? yearsExperienceFromJoinedOn(joined) : '';
  form.personal.languages = languages;
  form.personal.languagesOther = '';

  if (!form.mediaBrand) form.mediaBrand = {};
  if (!form.mediaBrand.social || typeof form.mediaBrand.social !== 'object') {
    form.mediaBrand.social = {
      instagram: '',
      facebook: '',
      youtube: '',
      linkedin: '',
      existingWebsite: '',
    };
  }
  const ig = String(p.instagram || '').trim();
  const yt = String(p.youtube || '').trim();
  const li = String(p.linkedin || '').trim();
  if (ig) form.mediaBrand.social.instagram = ig;
  else form.mediaBrand.social.instagram = '';
  if (yt) form.mediaBrand.social.youtube = yt;
  else form.mediaBrand.social.youtube = '';
  if (li) form.mediaBrand.social.linkedin = li;
  else form.mediaBrand.social.linkedin = '';

  return form;
}
