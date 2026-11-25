/**
 * Upline coach-website display consent for Transformation media.
 * Coach content OTP (verified) is separate — this gate is member email OTP.
 */

export const WEBSITE_DISPLAY_CONSENT_FLAG = 'ff.testimonial-upline-display-consent';
export const WEBSITE_DISPLAY_OTP_CONTACT_TYPE = 'testimonial-website-display';
export const WEBSITE_DISPLAY_OTP_HOURS = 24;

/**
 * Recipient key in otp_tokens_table (not the email — avoids clobbering login OTP).
 * @param {number|string} userId
 * @param {number|string} testimonialId
 */
export function websiteDisplayOtpRecipientKey(userId, testimonialId) {
  return `testimonial-website-display:${Number(userId)}:${Number(testimonialId)}`;
}

function truthyConsentAt(row) {
  const at = row?.website_display_consent_at ?? row?.websiteDisplayConsentAt ?? null;
  return at != null && String(at).trim() !== '';
}

/**
 * @param {object|null|undefined} row
 * @returns {boolean}
 */
export function hasWebsiteDisplayConsent(row) {
  return truthyConsentAt(row);
}

/**
 * Photo and/or video content already coach-verified.
 * @param {object|null|undefined} row
 * @returns {boolean}
 */
export function canRequestDisplayConsent(row) {
  if (!row) return false;
  const photoOk = String(row.status || '') === 'verified';
  const videoOk = String(row.video_status || row.videoStatus || '') === 'verified';
  return photoOk || videoOk;
}

/**
 * Eligible for public What We Say / What We Do when consent flag is ON.
 * @param {object|null|undefined} row
 * @returns {boolean}
 */
export function isPublicWebsiteEligible(row) {
  return canRequestDisplayConsent(row) && hasWebsiteDisplayConsent(row);
}

/**
 * Website owner must verify the same display-consent checkbox before any
 * downline media appears on their public /coach site.
 * @param {object|null|undefined} ownerRow Owner's testimonial row
 * @returns {boolean}
 */
export function ownerAllowsPublicTeamMedia(ownerRow) {
  return hasWebsiteDisplayConsent(ownerRow);
}

/**
 * Decide whether to load downline team media for a public coach page.
 * Flag OFF → legacy (no owner gate, no per-member consent).
 * Flag ON → owner must have consent_at; members still filtered separately.
 *
 * @param {{ consentFlagEnabled: boolean, ownerTestimonial: object|null|undefined }} args
 * @returns {{ allow: boolean, requireDisplayConsent: boolean }}
 */
export function resolvePublicTeamMediaAccess({
  consentFlagEnabled,
  ownerTestimonial,
} = {}) {
  if (!consentFlagEnabled) {
    return { allow: true, requireDisplayConsent: false };
  }
  if (!ownerAllowsPublicTeamMedia(ownerTestimonial)) {
    return { allow: false, requireDisplayConsent: true };
  }
  return { allow: true, requireDisplayConsent: true };
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function parseWebsiteDisplayAgreed(raw) {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}
