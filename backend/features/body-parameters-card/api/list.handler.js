/**
 * list.handler.js — GET handler for listing body parameter cards
 * Returns all cards for a coach's team members
 */
import { validateListCards } from '../validation/list.schema.js';
import { listCardsForCoach } from '../data/card.repo.js';
import logger from '../../../shared/lib/logger.js';

export async function handleListCards(req, res) {
  const { value, error: valError } = validateListCards({ coachId: req.query.coachId });
  if (valError) {
    logger.warn('[list.handler] Validation failed:', valError.details);
    return res.status(422).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: valError.message } });
  }

  try {
    const cards = await listCardsForCoach(value.coachId);
    logger.debug(`[list.handler] Found ${cards.length} cards for coach ${value.coachId}`);
    return res.status(200).json({ ok: true, data: cards });
  } catch (err) {
    logger.error('[list.handler] Error listing cards:', err);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to list cards' } });
  }
}
