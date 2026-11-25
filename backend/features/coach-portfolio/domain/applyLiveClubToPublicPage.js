/**
 * Overlay live club fields onto the public portfolio view-model.
 * Club-linked pages: name/photos/hours/phone/maps come from the centre, not FormJson.
 */
import { formatClockTimeLabel } from './submission.rules.js';
import { clubHoursToPublicTimings } from './clubHoursToPublicTimings.js';

function firstUrl(list) {
  if (!Array.isArray(list)) return null;
  const hit = list.map((u) => String(u || '').trim()).find(Boolean);
  return hit || null;
}

function allUrls(list) {
  if (!Array.isArray(list)) return [];
  return list.map((u) => String(u || '').trim()).filter(Boolean);
}

function whatsappDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * @param {object} page
 * @param {{
 *   hasClub?: boolean,
 *   centerName?: string|null,
 *   mapsLink?: string|null,
 *   latitude?: number|null,
 *   longitude?: number|null,
 *   locality?: string|null,
 *   city?: string|null,
 *   address?: string|null,
 *   openingHours?: object|null,
 *   photos?: Record<string, string[]>|null,
 *   ownerPhone?: string|null,
 * }|null} club
 * @returns {object}
 */
export function applyLiveClubToPublicPage(page, club) {
  if (!page || !club?.hasClub) return page;

  const centerName = String(club.centerName || '').trim();
  if (centerName) page.centerName = centerName;

  const mapsLink = String(club.mapsLink || '').trim();
  if (mapsLink) page.mapsLink = mapsLink;

  if (club.locality != null) page.locality = String(club.locality || '').trim();
  if (club.city != null) page.city = String(club.city || '').trim();
  if (club.address != null) {
    page.address = String(club.address || '').trim();
  } else if (centerName && !page.address) {
    page.address = centerName;
  }

  const lat = Number(club.latitude);
  const lng = Number(club.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    page.geoLatitude = lat;
    page.geoLongitude = lng;
  }

  const photos = club.photos && typeof club.photos === 'object' ? club.photos : {};
  const entrance = allUrls(photos.entrance);
  const interior = allUrls(photos.interior);
  const nameBoard = allUrls(photos.name_board);
  const activity = allUrls(photos.wellness_activity);

  // Live club wins over FormJson media (even when empty — clears stale CMS uploads).
  page.entrancePhoto = firstUrl(entrance);
  page.interiorPhotos = interior;
  page.nameBoardPhoto = firstUrl(nameBoard);
  page.activityPhotos = activity;

  const timings = clubHoursToPublicTimings(club.openingHours);
  page.workingDays = timings.workingDays;
  page.openingTime = formatClockTimeLabel(timings.openingTime) || '';
  page.closingTime = formatClockTimeLabel(timings.closingTime) || '';

  const ownerPhone = String(club.ownerPhone || '').trim();
  if (ownerPhone) {
    page.phone = ownerPhone;
    const digits = whatsappDigits(ownerPhone);
    if (digits) page.whatsapp = digits;
  }

  return page;
}
