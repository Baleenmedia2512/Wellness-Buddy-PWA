/**
 * Public coach website media from Team Transformation (downline).
 * Cached per coach so many visitors share one build.
 *
 * Image/video URLs are signed with TESTIMONIAL_FILE_BASE_URL (often the live
 * host) because JPEG/video bytes live on that server disk in local-dev setups.
 */
import cache, { cacheKeys } from '../../../utils/cache.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import * as testimonialsRepo from '../../testimonials/testimonials.repository.js';
import {
  WEBSITE_DISPLAY_CONSENT_FLAG,
  resolvePublicTeamMediaAccess,
} from '../../testimonials/domain/websiteDisplayConsent.rules.js';
import {
  emptyPublicTeamMedia,
  selectPublicTeamMediaCandidates,
  signPublicTeamMedia,
} from '../domain/public-team-media.rules.js';
import logger from '../../../shared/lib/logger.js';

/** Cache shorter than email signed URL (7d) so visitors refresh links often enough. */
const TEAM_MEDIA_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MEDIA_PROBE_TIMEOUT_MS = 4000;

export function portfolioTeamMediaCacheKey(coachUserId) {
  return cacheKeys.portfolioTeamMedia
    ? cacheKeys.portfolioTeamMedia(coachUserId)
    : `portfolio:team-media:${coachUserId}`;
}

export function bustPortfolioTeamMediaCache(coachUserId) {
  const id = Number(coachUserId);
  if (!Number.isFinite(id) || id <= 0) return;
  try {
    cache.delete(portfolioTeamMediaCacheKey(id));
  } catch {
    /* non-fatal */
  }
}

/**
 * Drop slides whose signed file URLs 404 (common when DB path exists but
 * MilesWeb/local disk file was never uploaded or was deleted).
 * @param {string|null} url
 * @returns {Promise<boolean>}
 */
async function isReachableMediaUrl(url) {
  if (!url) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MEDIA_PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: ctrl.signal,
    });
    return res.ok || res.status === 206;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Keep What We Do cards only when every present image URL actually loads.
 * @param {{ whatWeSay: object[], whatWeDo: object[] }} media
 */
async function filterReachableTeamMedia(media) {
  const whatWeDo = [];
  for (const item of media.whatWeDo || []) {
    const checks = [];
    if (item.beforeImageUrl) checks.push(isReachableMediaUrl(item.beforeImageUrl));
    if (item.afterImageUrl) checks.push(isReachableMediaUrl(item.afterImageUrl));
    if (!checks.length) continue;
    const results = await Promise.all(checks);
    if (results.every(Boolean)) whatWeDo.push(item);
  }

  const whatWeSay = [];
  for (const item of media.whatWeSay || []) {
    if (!item.healthVideoUrl) continue;
    if (await isReachableMediaUrl(item.healthVideoUrl)) whatWeSay.push(item);
  }

  return { whatWeSay, whatWeDo };
}

/**
 * @param {number|string} coachUserId portfolio owner (= coach)
 * @returns {Promise<{ whatWeSay: object[], whatWeDo: object[] }>}
 */
export async function getPublicTeamMediaForCoach(coachUserId) {
  const id = Number(coachUserId);
  if (!Number.isFinite(id) || id <= 0) return emptyPublicTeamMedia();

  const key = portfolioTeamMediaCacheKey(id);
  const hit = cache.get(key);
  if (hit && typeof hit === 'object') return hit;

  try {
    const consentOn = isEnabled(WEBSITE_DISPLAY_CONSENT_FLAG);
    // Consent ON → owner must have verified display consent, then full hierarchy
    // with per-member consent. Flag OFF → legacy direct + verified only.
    let ownerRow = null;
    if (consentOn) {
      try {
        ownerRow = await testimonialsRepo.findByUserId(id);
      } catch {
        ownerRow = null;
      }
    }
    const access = resolvePublicTeamMediaAccess({
      consentFlagEnabled: consentOn,
      ownerTestimonial: ownerRow,
    });
    if (!access.allow) {
      const empty = emptyPublicTeamMedia();
      cache.set(key, empty, TEAM_MEDIA_CACHE_TTL_MS);
      return empty;
    }

    const rows = await testimonialsRepo.listForCoach(
      id,
      access.requireDisplayConsent ? 'full' : 'direct',
    );
    const candidates = selectPublicTeamMediaCandidates(rows, {
      requireDisplayConsent: access.requireDisplayConsent,
    });
    const signed = await signPublicTeamMedia(candidates, {
      // 7-day signed URLs for public site (same helper as coach email).
      // Uses TESTIMONIAL_FILE_BASE_URL so local SSR points at live file host.
      signVideo: (path) => testimonialsRepo.getEmailSignedUrl(path),
      signImage: (path) => testimonialsRepo.getEmailSignedUrl(path),
    });
    const media = await filterReachableTeamMedia(signed);
    cache.set(key, media, TEAM_MEDIA_CACHE_TTL_MS);
    return media;
  } catch (err) {
    logger.warn('[coach-portfolio.public-team-media] failed', {
      coachUserId: id,
      message: err?.message || String(err),
    });
    return emptyPublicTeamMedia();
  }
}
