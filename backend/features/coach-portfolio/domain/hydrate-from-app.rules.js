/**
 * Fill FormJson fields from app profile / club.
 * Name + photo + Profile intro (title, about, joining date → years, social, languages)
 * always follow the live app. Other fields only fill when blank.
 */

import { shortenAreaLabel } from '../../../shared/lib/reverseGeocode.js';
import { normalizeHerbalifeJoinedOn } from '../../user/domain/profileIntro.rules.js';
import {
  DEFAULT_PORTFOLIO_OFFERINGS,
  offeringsAreEmpty,
} from './default-offerings.rules.js';
import { normalizeFormJson } from './submission.rules.js';

/** ISO 639-1 → display name for Profile languages on the public About checklist. */
const LANGUAGE_NAME_BY_CODE = Object.freeze({
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada',
  ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi',
  ur: 'Urdu', or: 'Odia', as: 'Assamese', ne: 'Nepali', si: 'Sinhala',
  ar: 'Arabic', zh: 'Chinese', es: 'Spanish', fr: 'French', de: 'German',
});

function blank(value) {
  return !String(value || '').trim();
}

/**
 * Public About line from Profile Date of joining Herbalife (IST calendar years).
 * @param {string|null|undefined} herbalifeJoinedOn dd/mm/yyyy
 * @param {Date} [now]
 * @returns {string}
 */
export function yearsExperienceFromJoinedOn(herbalifeJoinedOn, now = new Date()) {
  const normalized = normalizeHerbalifeJoinedOn(herbalifeJoinedOn, now);
  if (!normalized) return '';
  const [dd, mm, yyyy] = normalized.split('/').map((part) => Number(part));
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

function mapsLinkFromLatLng(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return '';
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/**
 * @param {object} rawForm
 * @param {{
 *   userName?: string|null,
 *   phoneNumber?: string|null,
 *   email?: string|null,
 *   avatarUrl?: string|null,
 *   centerName?: string|null,
 *   latitude?: number|string|null,
 *   longitude?: number|string|null,
 *   city?: string|null,
 *   locality?: string|null,
 *   professionalTitle?: string|null,
 *   aboutMe?: string|null,
 *   qualification?: string|null,
 *   herbalifeJoinedOn?: string|null,
 *   languages?: string[]|null,
 *   instagram?: string|null,
 *   youtube?: string|null,
 *   linkedin?: string|null,
 * }} app
 * @returns {object}
 */
export function hydratePortfolioFormFromApp(rawForm, app = {}) {
  const form = normalizeFormJson(rawForm);
  const userName = String(app.userName || '').trim();
  const phone = String(app.phoneNumber || '').trim();
  const email = String(app.email || '').trim();
  const avatarUrl = String(app.avatarUrl || '').trim();
  const centerName = String(app.centerName || '').trim();
  const city = String(app.city || '').trim();
  const locality = String(app.locality || '').trim();
  const mapsLink = mapsLinkFromLatLng(app.latitude, app.longitude);
  const professionalTitle = String(app.professionalTitle || '').trim();
  const aboutMe = String(app.aboutMe || '').trim();
  const qualification = String(app.qualification || '').trim();
  const herbalifeJoinedOn = String(app.herbalifeJoinedOn || '').trim();
  const instagram = String(app.instagram || '').trim();
  const youtube = String(app.youtube || '').trim();
  const linkedin = String(app.linkedin || '').trim();
  const languageNames = languageNamesFromCodes(app.languages);

  // Coach full name always follows the app profile (same as photo).
  if (userName) {
    form.personal.fullName = userName;
  }
  // Website display name is editable — only seed from app when blank.
  if (blank(form.mediaBrand.websiteDisplayName) && userName) {
    form.mediaBrand.websiteDisplayName = userName;
  }
  // Profile intro fields always follow the live Profile screen (empty Profile → clear stale FormJson defaults).
  form.personal.professionalTitle = professionalTitle;
  form.personal.professionalTitleOther = '';
  form.personal.background = aboutMe;
  form.personal.qualifications = qualification;
  if (herbalifeJoinedOn) {
    const yearsLabel = yearsExperienceFromJoinedOn(herbalifeJoinedOn);
    form.personal.yearsExperience = yearsLabel || '';
  } else {
    form.personal.yearsExperience = '';
  }
  form.personal.languages = languageNames;
  form.personal.languagesOther = '';
  if (!form.mediaBrand.social || typeof form.mediaBrand.social !== 'object') {
    form.mediaBrand.social = {
      instagram: '',
      facebook: '',
      youtube: '',
      linkedin: '',
      existingWebsite: '',
    };
  }
  if (instagram) form.mediaBrand.social.instagram = instagram;
  if (youtube) form.mediaBrand.social.youtube = youtube;
  if (linkedin) form.mediaBrand.social.linkedin = linkedin;
  // Profile photo always follows the app (dynamic) — do not keep a stale FormJson copy.
  if (avatarUrl) {
    form.personal.profilePhoto = avatarUrl;
  }
  if (blank(form.center.businessPhone) && phone) {
    form.center.businessPhone = phone;
  }
  if (blank(form.center.whatsapp) && phone) {
    form.center.whatsapp = phone;
  }
  if (blank(form.center.businessEmail) && email) {
    form.center.businessEmail = email;
  }
  // Linked club name always follows the owned center (never leave another centre's label).
  if (centerName) {
    form.center.centerName = centerName;
    if (blank(form.center.address)) {
      form.center.address = centerName;
    }
  }
  if (blank(form.center.mapsLink) && mapsLink) {
    form.center.mapsLink = mapsLink;
  }
  // City / area: fill only when blank so a map pick / saved place is not overwritten
  // by noisy reverse-geocode (e.g. village names). Shorten labels when we do fill.
  if (blank(form.center.city) && city) {
    form.center.city = shortenAreaLabel(city) || city;
  } else if (!blank(form.center.city)) {
    form.center.city = shortenAreaLabel(form.center.city) || form.center.city;
  }
  if (blank(form.center.locality) && locality) {
    form.center.locality = shortenAreaLabel(locality) || '';
  } else if (!blank(form.center.locality)) {
    form.center.locality = shortenAreaLabel(form.center.locality) || form.center.locality;
  }
  if (offeringsAreEmpty(form.services.offerings)) {
    form.services.offerings = [...DEFAULT_PORTFOLIO_OFFERINGS];
  }
  return form;
}
