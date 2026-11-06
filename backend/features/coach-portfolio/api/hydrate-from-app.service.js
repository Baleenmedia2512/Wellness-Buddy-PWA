/**
 * Load app profile + working club, then hydrate empty FormJson fields.
 */
import { findByUserId } from '../../user/user.repository.js';
import { avatarUrlForKey, r2AvatarsEnabled } from '../../user/avatar-storage.service.js';
import {
  findActiveCentersByOwnerIds,
  findCenterById,
} from '../../nutrition-centers/centers.repository.js';
import { fetchCityVillage } from '../../../shared/lib/reverseGeocode.js';
import { hydratePortfolioFormFromApp } from '../domain/hydrate-from-app.rules.js';

const EMPTY_CLUB = { hasClub: false, centerName: null, mapsLink: null, latitude: null, longitude: null };

/**
 * Coach's own active club only (latest registration). Never upline working-centre fallback.
 * Portfolio map / address / directions must not show someone else's club.
 *
 * @param {number} userId
 * @returns {Promise<{ hasClub: boolean, centerName: string|null, mapsLink: string|null, latitude: number|null, longitude: number|null }>}
 */
async function loadOwnClubForPortfolio(userId) {
  const owned = await findActiveCentersByOwnerIds([userId]);
  const list = Array.isArray(owned) ? owned : [];
  if (!list.length) return { ...EMPTY_CLUB };

  const sorted = [...list].sort((a, b) => {
    const atA = Date.parse(a?.registered_at || '') || 0;
    const atB = Date.parse(b?.registered_at || '') || 0;
    return atB - atA || (Number(b?.id) || 0) - (Number(a?.id) || 0);
  });
  const primary = sorted[0];
  const centerId = Number(primary?.id);
  if (!Number.isFinite(centerId) || centerId <= 0) return { ...EMPTY_CLUB };

  let centerName = String(primary?.center_name || '').trim() || null;
  let latitude = null;
  let longitude = null;
  let mapsLink = null;
  const { data: center } = await findCenterById(centerId);
  if (center) {
    // Safety: never treat another owner's center as this coach's club.
    if (Number(center.owner_user_id) !== userId) return { ...EMPTY_CLUB };
    centerName = String(center.center_name || centerName || '').trim() || null;
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      latitude = lat;
      longitude = lng;
      mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
    }
  }
  if (!centerName) return { ...EMPTY_CLUB };
  return { hasClub: true, centerName, mapsLink, latitude, longitude };
}

/**
 * Prefer the stable avatar API so the public site / form always get the latest app photo.
 * @param {object|null} user
 * @returns {string|null}
 */
export function profileAvatarUrl(user) {
  if (!user) return null;
  // Stable route always reflects current ProfileImageKey / ProfileImage.
  if (user.ProfileImageKey || user.ProfileImage) {
    return `/api/user/avatar?userId=${encodeURIComponent(user.UserId)}`;
  }
  const legacy = String(user.ProfileImage || '').trim();
  if (/^https?:\/\//i.test(legacy) || legacy.startsWith('data:image/')) {
    return legacy;
  }
  // Fallback when only R2 key helpers are available without DB image columns.
  if (r2AvatarsEnabled() && user.ProfileImageKey) {
    return avatarUrlForKey(user.ProfileImageKey) || null;
  }
  return null;
}

/**
 * Live app profile photo for a coach (public website).
 * @param {number|string} userId
 * @returns {Promise<string|null>}
 */
export async function getAppProfilePhotoUrl(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const user = await findByUserId(
    id,
    '"UserId", "ProfileImageKey", "ProfileImage"',
  );
  return profileAvatarUrl(user);
}

/**
 * Google profile URLs often ship as tiny =s96 thumbs. Bump for hero display.
 * @param {string} url
 * @returns {string}
 */
export function enlargeGoogleProfileUrl(url, size = 512) {
  const raw = String(url || '').trim();
  if (!raw || !/googleusercontent\.com/i.test(raw)) return raw;
  const side = Math.max(96, Math.min(1024, Number(size) || 512));
  if (/=s\d+/i.test(raw)) return raw.replace(/=s\d+/i, `=s${side}`);
  if (raw.includes('?')) return `${raw}&sz=${side}`;
  return `${raw}=s${side}`;
}

/**
 * Higher-quality face for the public portfolio hero.
 * Prefer Google HD URL over the ≤256px R2 avatar (avoids soft upscales).
 *
 * @param {number|string} userId
 * @returns {Promise<string|null>}
 */
export async function getAppPortfolioHeroPhotoUrl(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const user = await findByUserId(
    id,
    '"UserId", "ProfileImageKey", "ProfileImage"',
  );
  if (!user) return null;

  const profileImage = String(user.ProfileImage || '').trim();
  if (/^https?:\/\//i.test(profileImage)) {
    return enlargeGoogleProfileUrl(profileImage, 512);
  }
  if (profileImage.startsWith('data:image/')) {
    return profileImage;
  }
  return profileAvatarUrl(user);
}

/**
 * Live own club for the public portfolio map / address / directions.
 * Upline “working centre” does not count — coach must own the club.
 *
 * @param {number|string} userId
 * @returns {Promise<{
 *   hasClub: boolean,
 *   centerName: string|null,
 *   mapsLink: string|null,
 *   latitude: number|null,
 *   longitude: number|null,
 * }>}
 */
export async function getAppWorkingClubForPortfolio(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      hasClub: false,
      centerName: null,
      mapsLink: null,
      latitude: null,
      longitude: null,
    };
  }
  try {
    const club = await loadOwnClubForPortfolio(id);
    return {
      hasClub: club.hasClub,
      centerName: club.centerName,
      mapsLink: club.mapsLink,
      latitude: club.latitude,
      longitude: club.longitude,
    };
  } catch {
    return {
      hasClub: false,
      centerName: null,
      mapsLink: null,
      latitude: null,
      longitude: null,
    };
  }
}

/**
 * @param {number} userId
 * @param {object} form
 * @returns {Promise<object>}
 */
export async function hydrateFormWithAppData(userId, form) {
  const user = await findByUserId(
    userId,
    '"UserId", "UserName", "PhoneNumber", "Email", "ProfileImageKey", "ProfileImage"',
  );
  let centerName = null;
  let latitude = null;
  let longitude = null;
  let city = null;
  let locality = null;
  try {
    const club = await loadOwnClubForPortfolio(Number(userId));
    if (club.hasClub) {
      centerName = club.centerName;
      latitude = club.latitude;
      longitude = club.longitude;
      if (latitude != null && longitude != null) {
        const place = await fetchCityVillage(latitude, longitude);
        city = place.city || null;
        // Prefer neighbourhood/suburb as “area”; fall back to city only if nothing finer.
        locality = place.village || null;
      }
    }
  } catch {
    // Club lookup is best-effort — never block portfolio save/load.
  }

  return hydratePortfolioFormFromApp(form, {
    userName: user?.UserName || null,
    phoneNumber: user?.PhoneNumber || null,
    email: user?.Email || null,
    avatarUrl: profileAvatarUrl(user),
    centerName,
    latitude,
    longitude,
    city,
    locality,
  });
}
