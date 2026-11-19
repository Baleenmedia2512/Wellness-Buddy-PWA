/**
 * Load app profile + working club, then hydrate empty FormJson fields.
 */
import { findByUserId, getProfileIntro } from '../../user/user.repository.js';
import { avatarUrlForKey, r2AvatarsEnabled } from '../../user/avatar-storage.service.js';
import {
  findActiveCentersByOwnerIds,
  findCenterById,
} from '../../nutrition-centers/centers.repository.js';
import { fetchCityVillage } from '../../../shared/lib/reverseGeocode.js';
import { hydratePortfolioFormFromApp } from '../domain/hydrate-from-app.rules.js';

const EMPTY_CLUB = {
  hasClub: false,
  centerId: null,
  centerName: null,
  mapsLink: null,
  latitude: null,
  longitude: null,
};

function sortOwnedCenters(list) {
  return [...list].sort((a, b) => {
    const atA = Date.parse(a?.registered_at || '') || 0;
    const atB = Date.parse(b?.registered_at || '') || 0;
    return atB - atA || (Number(b?.id) || 0) - (Number(a?.id) || 0);
  });
}

/**
 * Load one owned active center (by id) with maps fields.
 * @param {number} userId
 * @param {number} centerId
 */
async function loadOwnedCenterDetails(userId, centerId) {
  const { data: center } = await findCenterById(centerId);
  if (!center) return { ...EMPTY_CLUB };
  // Safety: never treat another owner's center as this user's club.
  if (Number(center.owner_user_id) !== Number(userId)) return { ...EMPTY_CLUB };
  const centerName = String(center.center_name || '').trim() || null;
  if (!centerName) return { ...EMPTY_CLUB };
  let latitude = null;
  let longitude = null;
  let mapsLink = null;
  const lat = Number(center.latitude);
  const lng = Number(center.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    latitude = lat;
    longitude = lng;
    mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  }
  return {
    hasClub: true,
    centerId: Number(centerId),
    centerName,
    mapsLink,
    latitude,
    longitude,
  };
}

/**
 * Owner's own active clubs only. Never upline working-centre fallback.
 *
 * @param {number} userId
 * @param {number|null} [preferredCenterId]
 * @returns {Promise<{ hasClub: boolean, centerId: number|null, centerName: string|null, mapsLink: string|null, latitude: number|null, longitude: number|null }>}
 */
async function loadOwnClubForPortfolio(userId, preferredCenterId = null) {
  const owned = await findActiveCentersByOwnerIds([userId]);
  const list = Array.isArray(owned) ? owned : [];
  if (!list.length) return { ...EMPTY_CLUB };

  const preferred = Number(preferredCenterId);
  if (Number.isFinite(preferred) && preferred > 0) {
    const match = list.find((c) => Number(c?.id) === preferred);
    if (!match) return { ...EMPTY_CLUB };
    return loadOwnedCenterDetails(userId, preferred);
  }

  const primary = sortOwnedCenters(list)[0];
  const centerId = Number(primary?.id);
  if (!Number.isFinite(centerId) || centerId <= 0) return { ...EMPTY_CLUB };
  return loadOwnedCenterDetails(userId, centerId);
}

/**
 * All active nutrition centers owned by this user (for My Websites list + city/center dropdowns).
 * Best-effort reverse-geocode for city/area so Create New can show dropdowns.
 * @param {number|string} userId
 * @returns {Promise<Array<{ centerId: number, centerName: string, city: string|null, locality: string|null }>>}
 */
export async function listOwnedCentersForPortfolio(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return [];
  try {
    const owned = await findActiveCentersByOwnerIds([id]);
    const base = sortOwnedCenters(Array.isArray(owned) ? owned : [])
      .map((c) => ({
        centerId: Number(c.id),
        centerName: String(c.center_name || '').trim() || `Center ${c.id}`,
      }))
      .filter((c) => Number.isFinite(c.centerId) && c.centerId > 0);

    const enriched = [];
    for (const item of base) {
      let city = null;
      let locality = null;
      try {
        const details = await loadOwnedCenterDetails(id, item.centerId);
        if (details.hasClub && details.latitude != null && details.longitude != null) {
          const place = await fetchCityVillage(details.latitude, details.longitude);
          city = place.city || null;
          locality = place.village || null;
        }
      } catch {
        // Place lookup is best-effort for dropdown labels.
      }
      enriched.push({
        ...item,
        city: city ? String(city).trim() : null,
        locality: locality ? String(locality).trim() : null,
      });
    }
    return enriched;
  } catch {
    return [];
  }
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
 * Upline “working centre” does not count — owner must own the club.
 *
 * @param {number|string} userId
 * @param {number|string|null} [centerId]
 * @returns {Promise<{
 *   hasClub: boolean,
 *   centerId: number|null,
 *   centerName: string|null,
 *   mapsLink: string|null,
 *   latitude: number|null,
 *   longitude: number|null,
 * }>}
 */
export async function getAppWorkingClubForPortfolio(userId, centerId = null) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ...EMPTY_CLUB };
  }
  try {
    const club = await loadOwnClubForPortfolio(id, centerId);
    return {
      hasClub: club.hasClub,
      centerId: club.centerId,
      centerName: club.centerName,
      mapsLink: club.mapsLink,
      latitude: club.latitude,
      longitude: club.longitude,
    };
  } catch {
    return { ...EMPTY_CLUB };
  }
}

/**
 * @param {number} userId
 * @param {object} form
 * @param {{ centerId?: number|null }} [opts]
 * @returns {Promise<object>}
 */
export async function hydrateFormWithAppData(userId, form, { centerId = null } = {}) {
  const user = await findByUserId(
    userId,
    '"UserId", "UserName", "PhoneNumber", "Email", "ProfileImageKey", "ProfileImage"',
  );
  let centerName = null;
  let latitude = null;
  let longitude = null;
  let city = null;
  let locality = null;
  let intro = {
    professionalTitle: '',
    aboutMe: '',
    qualification: '',
    herbalifeJoinedOn: '',
    languages: [],
    instagram: '',
    youtube: '',
    linkedin: '',
  };
  try {
    intro = await getProfileIntro(userId);
  } catch {
    // Intro columns may be missing on older DBs — never block portfolio.
  }
  try {
    // Freestyle (no CenterId): keep typed City/Area — do not overwrite from primary club GPS.
    if (centerId != null) {
      const club = await loadOwnClubForPortfolio(Number(userId), centerId);
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
    professionalTitle: intro.professionalTitle,
    aboutMe: intro.aboutMe,
    qualification: intro.qualification,
    herbalifeJoinedOn: intro.herbalifeJoinedOn,
    languages: intro.languages,
    instagram: intro.instagram,
    youtube: intro.youtube,
    linkedin: intro.linkedin,
  });
}
