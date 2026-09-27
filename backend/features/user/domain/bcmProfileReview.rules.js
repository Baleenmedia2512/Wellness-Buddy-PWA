/**
 * BCM / Body Parameters Card — Complete Profile review gate.
 * Once confirmed, the flag lives on team_table (not device localStorage).
 */

/**
 * @param {unknown} reviewedAt
 * @returns {boolean}
 */
export function isBcmProfileReviewedRecorded(reviewedAt) {
  if (reviewedAt == null) return false;
  if (typeof reviewedAt === 'string' && reviewedAt.trim() === '') return false;
  return true;
}

/**
 * Force Complete Profile once for BCM/BPC leads until the account has reviewed.
 * @param {{ isBcmLead?: boolean, bcmProfileReviewed?: boolean }} input
 * @returns {boolean}
 */
export function shouldForceBcmProfileReview({
  isBcmLead = false,
  bcmProfileReviewed = false,
} = {}) {
  return isBcmLead === true && bcmProfileReviewed !== true;
}
