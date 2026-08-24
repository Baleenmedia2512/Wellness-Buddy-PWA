/**
 * phone-status.handler.js — GET /api/body-parameters-card/phone-status
 * Reports whether a phone belongs to an activated member (BCM blocked).
 */
import { validatePhoneStatusQuery } from '../validation/card.schema.js';
import { canSearchTeamPhones } from '../domain/permissions/card.policy.js';
import { getBcmPhoneActivationStatus } from '../data/card.repo.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { BCM_ACTIVATED_MEMBER_MESSAGE } from '../domain/card.rules.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {object} query - raw Next.js req.query
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
export async function handlePhoneStatus(query) {
  const { phoneNumber, coachId } = validatePhoneStatusQuery(query);

  if (!canSearchTeamPhones({ coachId })) {
    throw new ValidationError(403, 'Not authorised to check phone status');
  }

  const { activated, userId, existingCard } = await getBcmPhoneActivationStatus(phoneNumber, {
    coachId,
  });

  logger.info('[body-params-card] phone-status', {
    coachId,
    activated,
    hasUser: userId != null,
    hasExistingCard: Boolean(existingCard?.id),
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        activated,
        message: activated ? BCM_ACTIVATED_MEMBER_MESSAGE : null,
        existingCard: activated ? null : existingCard,
      },
    },
  };
}
