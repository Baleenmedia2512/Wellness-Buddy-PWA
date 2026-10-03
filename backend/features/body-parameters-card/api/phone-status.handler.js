/**
 * phone-status.handler.js — GET /api/body-parameters-card/phone-status
 * Activated members are blocked. Override is offered only for a BCM this coach
 * counselled. A co-sponsor's card is not returned.
 */
import { validatePhoneStatusQuery } from '../validation/card.schema.js';
import { canSearchTeamPhones } from '../domain/permissions/card.policy.js';
import { getBcmPhoneActivationStatus } from '../data/card.repo.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import {
  BCM_ACTIVATED_MEMBER_MESSAGE,
  BCM_COUNSELLED_BY_OTHER_MESSAGE,
} from '../domain/card.rules.js';
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

  const {
    activated,
    userId,
    existingCard,
    canOverride,
    counselledByOther,
  } = await getBcmPhoneActivationStatus(phoneNumber, { coachId });

  let message = null;
  if (activated) message = BCM_ACTIVATED_MEMBER_MESSAGE;
  else if (counselledByOther) message = BCM_COUNSELLED_BY_OTHER_MESSAGE;

  logger.info('[body-params-card] phone-status', {
    coachId,
    activated,
    canOverride,
    counselledByOther,
    hasUser: userId != null,
    hasExistingCard: Boolean(existingCard?.id),
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        activated,
        message,
        userId: userId != null ? userId : null,
        exists: userId != null,
        canOverride: canOverride === true,
        counselledByOther: counselledByOther === true,
        existingCard: canOverride ? existingCard : null,
      },
    },
  };
}
