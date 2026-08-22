/**
 * member-prefill.handler.js — Prefill BCM form from a team member's profile + weight.
 */
import { validateMemberPrefillQuery } from '../validation/card.schema.js';
import { canSearchTeamPhones } from '../domain/permissions/card.policy.js';
import { getMemberPrefillForCard } from '../data/card.repo.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {object} query
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
export async function handleMemberPrefill(query) {
  const { userId, coachId } = validateMemberPrefillQuery(query);

  // Same gate as phone-search (coachId present). Do not use reporting-hierarchy
  // assert here — co-coach / nested members appear in client team list but can
  // fail assertViewerCanAccessMember, which blocked weight/fat/BMI prefill.
  if (!canSearchTeamPhones({ coachId })) {
    throw new ValidationError(403, 'Not authorised to prefill member profile');
  }

  const prefill = await getMemberPrefillForCard(userId);
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
