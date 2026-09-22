/**
 * Who receives Transformation / testimonial OTP email.
 *
 * Prefer the member's CoachId (sponsor). Top-level leads (admin / no upline)
 * often have no CoachId — then fall back to their co-coach partner from
 * coach_teams_table (the other of CoachId | CoCoachId).
 */

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function toPositiveUserId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * From an active coach_teams lead row, return the partner of `userId`.
 * @param {{ userId: unknown, coachId?: unknown, coCoachId?: unknown }} input
 * @returns {number|null}
 */
export function resolveCoCoachPartnerId({ userId, coachId, coCoachId }) {
  const uid = toPositiveUserId(userId);
  const sponsorId = toPositiveUserId(coachId);
  const partnerId = toPositiveUserId(coCoachId);
  if (!uid) return null;
  if (sponsorId === uid) return partnerId;
  if (partnerId === uid) return sponsorId;
  return null;
}

/**
 * Pick OTP email recipient: coach first, else co-coach partner.
 * @param {{ memberCoachId?: unknown, coCoachPartnerId?: unknown }} input
 * @returns {{ recipientId: number|null, source: 'coach'|'co-coach'|null }}
 */
export function resolveOtpRecipientIds({ memberCoachId = null, coCoachPartnerId = null } = {}) {
  const coachId = toPositiveUserId(memberCoachId);
  if (coachId) return { recipientId: coachId, source: 'coach' };

  const coId = toPositiveUserId(coCoachPartnerId);
  if (coId) return { recipientId: coId, source: 'co-coach' };

  return { recipientId: null, source: null };
}
