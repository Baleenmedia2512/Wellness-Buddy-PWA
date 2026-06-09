/**
 * pendingBodyParamsCard.js
 *
 * Stores the body-parameters card data when a share link is opened
 * before the user completes setup. The setup wizard reads this to
 * pre-fill its form fields.
 *
 * Uses the shared storage wrapper — never localStorage directly
 * (per claude.md §2.5).
 */
import storage from '../../../shared/lib/storage.js';

const KEY = 'wv.pendingBodyParamsCard';

/**
 * Persist card data for pre-fill during setup.
 * @param {object} card - from fetchPublicCard()
 */
export function savePendingCard(card) {
  storage.set(KEY, JSON.stringify(card));
}

/**
 * Read and clear the pending card.
 * Returns null if none stored.
 * @returns {object|null}
 */
export function consumePendingCard() {
  const raw = storage.get(KEY);
  if (!raw) return null;
  storage.remove(KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Peek at the pending card without clearing it.
 * @returns {object|null}
 */
export function peekPendingCard() {
  const raw = storage.get(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
