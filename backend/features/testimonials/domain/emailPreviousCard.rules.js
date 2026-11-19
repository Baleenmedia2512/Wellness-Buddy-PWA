/**
 * When the Transformation OTP email may show Previous | New cards.
 *
 * A Mine card often clones After from Before (same path). That is still a
 * previous card the sponsor should see. First submit with no previous photos
 * stays on the single current card.
 */
import { isPlaceholderImagePath } from './photoCompleteness.rules.js';

/**
 * @param {string|null|undefined} previousBeforePath
 * @param {string|null|undefined} previousAfterPath
 */
export function hasPreviousCardForEmailCompare(previousBeforePath, previousAfterPath) {
  if (isPlaceholderImagePath(previousBeforePath)) return false;
  const after = previousAfterPath || previousBeforePath;
  return !isPlaceholderImagePath(after);
}

/**
 * @param {{
 *   previousBeforePath?: string|null,
 *   previousAfterPath?: string|null,
 *   cardDetailsChanged?: boolean,
 * }} input
 */
export function shouldShowPreviousNewEmailCards({
  previousBeforePath,
  previousAfterPath,
  cardDetailsChanged,
} = {}) {
  return Boolean(
    cardDetailsChanged
    && hasPreviousCardForEmailCompare(previousBeforePath, previousAfterPath),
  );
}

/**
 * Storage paths to compose the Previous column. Clone After (same as Before) is kept.
 * @param {{
 *   previousBeforePath?: string|null,
 *   previousAfterPath?: string|null,
 *   currentBeforePath?: string|null,
 *   currentAfterPath?: string|null,
 * }} input
 */
export function previousEmailCardPaths({
  previousBeforePath,
  previousAfterPath,
  currentBeforePath,
  currentAfterPath,
} = {}) {
  const before = previousBeforePath || currentBeforePath || null;
  const after = previousAfterPath || previousBeforePath || currentAfterPath || null;
  return { beforePath: before, afterPath: after };
}
