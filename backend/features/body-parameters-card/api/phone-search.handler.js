/**
 * phone-search.handler.js — Handles GET /api/body-parameters-card/phone-search
 * Returns up to 10 team members whose phone starts with the given prefix.
 * Scoped to the requesting coach's CoachId.
 */
import { validatePhoneSearchQuery } from '../validation/card.schema.js';
import { canSearchTeamPhones } from '../domain/permissions/card.policy.js';
import { searchTeamPhonesByPrefix } from '../data/card.repo.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {object} query - raw Next.js req.query
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handlePhoneSearch(query) {
  const { prefix, coachId } = validatePhoneSearchQuery(query);

  if (!canSearchTeamPhones({ coachId })) {
    throw new ValidationError(403, 'Not authorised to search team phones');
  }

  const members = await searchTeamPhonesByPrefix({ prefix, coachId });

  logger.info('[body-params-card] phone-search', { prefix, coachId, hits: members.length });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: members,
    },
  };
}
