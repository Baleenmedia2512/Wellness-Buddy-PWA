/**
 * list.handler.js — GET handler for listing body parameter cards
 * Supports page / limit / search pagination and single-card detail via cardId.
 */
import { validateListCards } from '../validation/list.schema.js';
import { listCardsForCoach, getCardByIdForCoach } from '../data/card.repo.js';
import logger from '../../../shared/lib/logger.js';

export async function handleListCards(req, res) {
  const coachId = parseInt(req.query.coachId, 10);
  const cardIdRaw = req.query.cardId;
  const cardId = cardIdRaw != null && cardIdRaw !== ''
    ? parseInt(String(cardIdRaw), 10)
    : undefined;

  const { value, error: valError } = validateListCards({
    coachId,
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
    cardId: Number.isFinite(cardId) ? cardId : undefined,
  });

  if (valError) {
    logger.warn('[list.handler] Validation failed:', valError.details);
    return res.status(422).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: valError.message },
    });
  }

  try {
    // Single-card full detail for edit form
    if (value.cardId) {
      const card = await getCardByIdForCoach(value.coachId, value.cardId);
      if (!card) {
        return res.status(404).json({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Card not found' },
        });
      }
      return res.status(200).json({ ok: true, data: card });
    }

    const { cards, pagination } = await listCardsForCoach(value.coachId, {
      page: value.page,
      limit: value.limit,
      search: value.search,
    });

    return res.status(200).json({ ok: true, data: cards, pagination });
  } catch (err) {
    logger.error('[list.handler] Error listing cards:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to list cards' },
    });
  }
}
