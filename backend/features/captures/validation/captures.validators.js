/**
 * backend/features/captures/validation/captures.validators.js
 * ---------------------------------------------------------------------------
 * Validation layer for capture operations.
 * Per claude.md §3.2, all input shape/type/range checks go here (not in service).
 * ---------------------------------------------------------------------------
 */

/**
 * Validate delete capture input.
 * @param {Object} body
 * @param {string|number} body.captureId - The capture primary key
 * @param {string|number} body.userId - The owner user ID
 * @returns {Object} { captureId, userId }
 * @throws {Error} with status 400 if validation fails
 */
export function validateDeleteInput(body) {
  const { captureId, userId } = body || {};

  if (!captureId) {
    const err = new Error('captureId is required');
    err.status = 400;
    throw err;
  }

  if (!userId) {
    const err = new Error('userId is required');
    err.status = 400;
    throw err;
  }

  // Coerce to string for consistency with DB layer
  return {
    captureId: String(captureId),
    userId: String(userId),
  };
}
