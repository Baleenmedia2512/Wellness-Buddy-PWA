/**
 * list.handler.js — GET handler for listing body parameter cards
 * Returns all cards for a coach's team members
 */
import { validateListCards } from '../validation/list.schema.js';
import { listCardsForCoach } from '../data/card.repo.js';
import logger from '../../../shared/lib/logger.js';

export async function handleListCards(req, res) {
  // Parse coachId as a number since it comes from query string
  const coachId = parseInt(req.query.coachId, 10);
  
  logger.info('[list.handler] 🔍 REQUEST RECEIVED', { 
    coachId, 
    rawCoachId: req.query.coachId,
    query: req.query 
  });
  
  const { value, error: valError } = validateListCards({ coachId });
  if (valError) {
    logger.warn('[list.handler] ❌ Validation failed:', valError.details);
    return res.status(422).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: valError.message } });
  }

  logger.info('[list.handler] ✅ Validation passed, querying database', { coachId: value.coachId });

  try {
    const cards = await listCardsForCoach(value.coachId);
    logger.info(`[list.handler] 🎯 FOUND ${cards.length} CARDS for coach ${value.coachId}`);
    logger.info('[list.handler] 📦 Returning cards:', { 
      count: cards.length,
      cardIds: cards.map(c => c.id),
      firstCard: cards[0] ? { id: cards[0].id, name: cards[0].name } : null
    });
    return res.status(200).json({ ok: true, data: cards });
  } catch (err) {
    logger.error('[list.handler] 💥 ERROR listing cards:', err);
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to list cards' } });
  }
}
