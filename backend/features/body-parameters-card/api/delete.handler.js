/**
 * delete.handler.js — Soft-deletes a body-parameters card owned by the coach.
 */
import { validateDeleteCard } from '../validation/card.schema.js';
import { canDeleteCard } from '../domain/permissions/card.policy.js';
import { softDeleteCard, invalidateBpcListCache } from '../data/card.repo.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {object} body - raw request body (`id`, `coachId`)
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleDeleteCard(body) {
  const { id, coachId } = validateDeleteCard(body);

  if (!canDeleteCard({ coachId })) {
    throw new ValidationError(403, 'Not authorised to delete this body-parameters card');
  }

  const deleted = await softDeleteCard({ id, coachId });
  if (!deleted) {
    throw new ValidationError(404, 'Card not found');
  }

  invalidateBpcListCache(coachId);
  logger.info('[body-params-card] soft-deleted', { id, coachId });

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: { id: deleted.id },
    },
  };
}
