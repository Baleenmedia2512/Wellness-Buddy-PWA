/**
 * create.handler.js — Orchestrates body-parameters card creation.
 * Calls validation → permissions → data. No HTTP concerns here.
 */
import { validateCreateCard } from '../validation/card.schema.js';
import { canCreateCard } from '../domain/permissions/card.policy.js';
import { insertCard, findOrCreateTeamMember } from '../data/card.repo.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {object} body - raw request body
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleCreateCard(body) {
  const payload = validateCreateCard(body);

  if (!canCreateCard({ isCoach: true })) {
    throw new ValidationError(403, 'Not authorised to create a body-parameters card');
  }

  let userId = payload.userId;

  if (payload.phoneNumber) {
    logger.info('[body-params-card] resolving team member by phone', {
      coachId: payload.createdBy,
      hasExistingUserId: Boolean(userId),
    });
    userId = await findOrCreateTeamMember({
      name:        payload.name,
      phoneNumber: payload.phoneNumber,
      coachId:     payload.createdBy,
      heightCm:    payload.heightCm,
      bmr:         payload.bmr,
    });
    logger.info('[body-params-card] team member resolved', { userId });
  }

  const card = await insertCard({ ...payload, userId });

  return {
    httpStatus: 201,
    body: {
      success: true,
      data: {
        id:               card.id,
        publicShareToken: card.public_share_token,
        shareExpiresAt:   card.share_expires_at,
        name:             card.name,
      },
    },
  };
}
