/**
 * history.handler.js — Member body-parameter snapshots for Reports Trend.
 */
import { validateCardHistoryQuery } from '../validation/history.schema.js';
import { listVisibleCardHistoryByUserId } from '../data/card.repo.js';

/**
 * @param {object} query
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
export async function handleCardHistory(query) {
  const { userId, viewerUserId } = validateCardHistoryQuery(query);
  const cards = await listVisibleCardHistoryByUserId(userId, viewerUserId);
  return {
    httpStatus: 200,
    body: { ok: true, data: cards },
  };
}
