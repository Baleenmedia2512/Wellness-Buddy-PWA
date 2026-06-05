/**
 * backend/features/captures/domain/permissions/retry.policy.js
 * ---------------------------------------------------------------------------
 * PR-A / ADR-0003 — Diary "Retry" and "Edit" permission policy.
 *
 * Pure domain module. NO I/O. Given a pre-fetched coach chain, decides
 * whether a viewer may mutate (Retry / Edit) a capture they did not
 * personally upload.
 *
 * Allowed actors:
 *   1. The capture OWNER (viewerId === ownerId).
 *   2. Any user in the OWNER's coach upline chain.
 *      The "coach chain" is the same chain produced by
 *      `backend/features/background-analysis/analysis.repository.js ::
 *      getCoachChain(ownerId)` — i.e. the ownerId plus every CoachId hop
 *      up to depth 10. Convention there: chain[0] === ownerId.
 *
 * Denied:
 *   - Co-coach partners (peers of the owner's coach). Co-coaches have no
 *     supervisory relationship with the owner. This mirrors the explicit
 *     denial in `resolvePublicCapture` (analysis.service.js line ~434).
 *   - Anonymous viewers (no viewerId).
 *   - Strangers (viewerId not in the chain).
 *
 * The caller MUST fetch the coach chain via the existing helper — this
 * module never touches the DB so it can be unit-tested with zero mocks.
 *
 * @typedef  {Object} RetryPolicyDecision
 * @property {boolean} allowed
 * @property {'OWNER'|'COACH'} [actorRole]  Why it was allowed (when allowed).
 * @property {'NO_VIEWER'|'NO_OWNER'|'NOT_IN_CHAIN'} [reason]  Why denied.
 * ---------------------------------------------------------------------------
 */

/**
 * Decide whether a viewer may Retry/Edit a capture owned by `ownerId`.
 *
 * @param {Object} input
 * @param {string|number|null|undefined} input.viewerId  authenticated session user
 * @param {string|number|null|undefined} input.ownerId   capture.UserID
 * @param {Array<string|number>}         input.coachChain  output of repo.getCoachChain(ownerId)
 * @returns {RetryPolicyDecision}
 */
export function canRetryCapture({ viewerId, ownerId, coachChain = [] }) {
  if (viewerId == null || viewerId === '') {
    return { allowed: false, reason: 'NO_VIEWER' };
  }
  if (ownerId == null || ownerId === '') {
    return { allowed: false, reason: 'NO_OWNER' };
  }

  const viewerKey = String(viewerId);
  const ownerKey  = String(ownerId);

  if (viewerKey === ownerKey) {
    return { allowed: true, actorRole: 'OWNER' };
  }

  // Normalise the chain to strings for comparison. The chain MUST start
  // with ownerId; we already handled the owner case above, so any other
  // entry that matches viewerKey is a real coach hop.
  const chainKeys = (coachChain || []).map((id) => String(id));
  if (chainKeys.includes(viewerKey)) {
    return { allowed: true, actorRole: 'COACH' };
  }

  return { allowed: false, reason: 'NOT_IN_CHAIN' };
}

/**
 * Throwing variant for orchestration code. Mirrors the
 * `assertCanTransition` shape used by the captures state machine so
 * callers can keep a uniform try/catch posture.
 *
 * On denial: throws an Error with `status = 401` (no viewer) or `403`
 * (viewer present but not authorised), and a stable `code` field.
 */
export function assertCanRetryCapture(input) {
  const decision = canRetryCapture(input);
  if (decision.allowed) return decision;

  const isAuthIssue = decision.reason === 'NO_VIEWER';
  const err = new Error(
    isAuthIssue
      ? 'Authentication required to retry this capture'
      : 'You do not have permission to retry this capture',
  );
  err.status = isAuthIssue ? 401 : 403;
  err.code   = isAuthIssue ? 'UNAUTHENTICATED' : 'FORBIDDEN_RETRY';
  err.reason = decision.reason;
  throw err;
}
