/**
 * Overlay live club fields onto the public portfolio view-model.
 * Club-linked pages: name/photos/hours/phone come from the centre, not FormJson.
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
 *   openingHours?: object|null,
 *   photos?: Record<string, string[]>|null,
 *   ownerPhone?: string|null,
 * }|null} club
 * @returns {object}
 */
export function applyLiveClubToPublicPage(page, club) {
  if (!page || !club?.hasClub) return page;

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
