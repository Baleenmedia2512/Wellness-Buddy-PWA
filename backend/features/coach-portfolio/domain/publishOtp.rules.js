/**
 * Coach website self-publish OTP constants.
 * OTP is emailed to the coach; verify then publishes /coach/<slug>.
 */

export const PUBLISH_OTP_CONTACT_TYPE = 'coach-portfolio-publish';
export const PUBLISH_OTP_HOURS = 24;

/**
 * Recipient key in otp_tokens_table — not the email string (avoids clobbering login OTP).
 * Includes centerId so multi-site publish OTPs do not cancel each other.
 */
export function publishOtpRecipientKey(userId, centerId = null) {
  const uid = Number(userId);
  const cid = Number(centerId);
  if (Number.isFinite(cid) && cid > 0) {
    return `portfolio-publish:${uid}:${cid}`;
  }
  return `portfolio-publish:${uid}`;
}
