/**
 * member-prefill.handler.js — Prefill BCM form from a team member's profile + weight.
 */
import { validateMemberPrefillQuery } from '../validation/card.schema.js';
import { canSearchTeamPhones } from '../domain/permissions/card.policy.js';
import { getMemberPrefillForCard } from '../data/card.repo.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';
import {
  mapTransformationPhotosForClient,
  shouldPreferTransformationR2Urls,
  transformationPhotoUrlForKey,
} from '../../user/domain/transformationPhotos.rules.js';

/**
 * Same photo shape as profile: file URL for this app version, saved image data for older apps.
 * @param {object|null} raw
 * @param {string|null} appVersion
 */
async function mapPrefillPhotos(raw, appVersion) {
  const preferR2 = shouldPreferTransformationR2Urls({ appVersion });
  let resolveR2Url = transformationPhotoUrlForKey;
  if (preferR2) {
    try {
      const { isMileswebStorageEnabled } = await import('../../../shared/lib/milesweb/config.js');
      if (isMileswebStorageEnabled()) {
        const { resolveTransformationPhotoUrls } = await import('../../user/transformation-photo-storage.service.js');
        resolveR2Url = await resolveTransformationPhotoUrls(raw);
      }
    } catch (err) {
      logger.warn('[body-params-card] transformation photo url lookup skipped', {
        message: err?.message || String(err),
      });
    }
  }
  return mapTransformationPhotosForClient(raw, { preferR2, resolveR2Url });
}

/**
 * @param {object} query
 * @param {{ appVersion?: string|null }} [options]
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
export async function handleMemberPrefill(query, { appVersion = null } = {}) {
  const { userId, coachId } = validateMemberPrefillQuery(query);

  // Same gate as phone-search (coachId present). Do not use reporting-hierarchy
  // assert here — co-coach / nested members appear in client team list but can
  // fail assertViewerCanAccessMember, which blocked weight/fat/BMI prefill.
  if (!canSearchTeamPhones({ coachId })) {
    throw new ValidationError(403, 'Not authorised to prefill member profile');
  }

  const prefill = await getMemberPrefillForCard(userId, {
    mapPhotos: (raw) => mapPrefillPhotos(raw, appVersion),
  });
  if (!prefill) {
    throw new ValidationError(404, 'Member not found');
  }

  logger.info('[body-params-card] member-prefill', {
    coachId,
    userId,
    hasWeight: prefill.weightKg != null,
    hasFat: prefill.fatPercent != null,
    hasBmi: prefill.bmi != null,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: prefill,
    },
  };
}
