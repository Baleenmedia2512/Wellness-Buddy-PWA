/**
 * update.handler.js — Orchestrates body-parameters card updates.
 * Calls validation → data. No HTTP concerns here.
 */
import { validateUpdateCard } from '../validation/card.schema.js';
import { updateCard } from '../data/card.repo.js';

/**
 * @param {object} body - raw request body (must include `id`)
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleUpdateCard(body) {
  const payload = validateUpdateCard(body);

  const card = await updateCard(payload.id, payload);

  return {
    httpStatus: 200,
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
