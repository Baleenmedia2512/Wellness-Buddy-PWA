/**
 * Fill FormJson fields from app profile / club.
 * Name + photo always follow the live app. Other fields only fill when blank.
 */

import { shortenAreaLabel } from '../../../shared/lib/reverseGeocode.js';
import {
  DEFAULT_PORTFOLIO_OFFERINGS,
  offeringsAreEmpty,
} from './default-offerings.rules.js';
import { normalizeFormJson } from './submission.rules.js';

function blank(value) {
  return !String(value || '').trim();
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

  // Coach full name always follows the app profile (same as photo).
  if (userName) {
    form.personal.fullName = userName;
  }
  // Website display name is editable — only seed from app when blank.
  if (blank(form.mediaBrand.websiteDisplayName) && userName) {
    form.mediaBrand.websiteDisplayName = userName;
  }
  if (blank(form.personal.professionalTitle)) {
    form.personal.professionalTitle = 'Wellness Coach';
  }
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
  if (blank(form.center.centerName) && centerName) {
    form.center.centerName = centerName;
  }
  if (blank(form.center.address) && centerName) {
    form.center.address = centerName;
  }
  if (blank(form.center.mapsLink) && mapsLink) {
    form.center.mapsLink = mapsLink;
  }
  // City / area always follow live club GPS reverse-geocode when available.
  // Area stays short (Adyar, Vadapalani) — never a long address string.
  if (city) {
    form.center.city = shortenAreaLabel(city) || city;
  }
  if (locality) {
    form.center.locality = shortenAreaLabel(locality) || '';
  } else if (!blank(form.center.locality)) {
    form.center.locality = shortenAreaLabel(form.center.locality) || form.center.locality;
  }
  if (offeringsAreEmpty(form.services.offerings)) {
    form.services.offerings = [...DEFAULT_PORTFOLIO_OFFERINGS];
  }
  return form;
}
