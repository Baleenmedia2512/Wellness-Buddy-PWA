/**
 * BCM / Body Parameters Card — Complete Profile review gate.
 * Mirrors backend/features/user/domain/bcmProfileReview.rules.js
 * Source of truth after confirm is GET /api/user/profile → bcmProfileReviewed
 * (team_table.BcmProfileReviewedAt). localStorage is cache only.
 */

/**
 * @param {{ isBcmLead?: boolean, bcmProfileReviewed?: boolean }} input
 * @returns {boolean}
 */
export function shouldForceBcmProfileReview({
  isBcmLead = false,
  bcmProfileReviewed = false,
} = {}) {
  return isBcmLead === true && bcmProfileReviewed !== true;
}
