/**
 * submit-review.handler.js
 * Orchestrates persistence of a user's reverse-progress accountability review.
 *
 * Three-layer rule (claude.md §3.1):
 *   validation/ → domain (none needed here beyond schema) → data/
 */
import { validateSubmitReview } from '../validation/submit-review.schema.js';
import { saveProgressReview } from '../data/weight-progress.repo.js';
import logger from '../../../shared/lib/logger.js';

/**
 * Validate and persist a reverse-progress review.
 *
 * @param {object} body  Raw request body.
 * @returns {{ ok: true, data: { weightRecordId: number, message: string } }}
 * @throws {ValidationError | Error}
 */
export async function submitReviewHandler(body) {
  logger.info('[submitReview] Handler started', { userId: body?.userId });

  const validated = validateSubmitReview(body);

  const weightRecordId = await saveProgressReview(validated);

  logger.info('[submitReview] Review saved on weight record', {
    weightRecordId,
    userId: validated.userId,
    followedPlan: validated.followedPlan,
    goalMode: validated.goalMode,
  });

  return {
    ok: true,
    data: {
      weightRecordId,
      message: 'Review submitted successfully',
    },
  };
}
