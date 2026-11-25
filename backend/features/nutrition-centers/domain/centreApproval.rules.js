/**
 * Coach email OTP before a new nutrition centre is registered.
 * Apps below 3.5.7, and requests with no version, may register without it
 * when they also omit the new listing fields. When opening hours are sent,
 * the coach must already have approved.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';

export const CENTRE_APPROVAL_MIN_APP_VERSION = '3.5.7';
export const CENTRE_APPROVAL_CONTACT_TYPE = 'centre_register_coach';
export const CENTRE_APPROVAL_TTL_MINUTES = 20;

export function requiresCentreCoachApproval(appVersion) {
  return isAtLeastVersion(appVersion, CENTRE_APPROVAL_MIN_APP_VERSION) === true;
}

/**
 * New registration form sends opening hours. Older apps omit them.
 * Either case at 3.5.7+ still needs coach approval.
 */
export function centreRegisterNeedsCoachApproval({ appVersion, openingHours }) {
  if (requiresCentreCoachApproval(appVersion)) return true;
  return openingHours != null;
}

export function centreApprovalRecipientKey(userId) {
  return `centre-register:${Number(userId)}`;
}

export function centreApprovalExpiryIst(minutesFromNow = CENTRE_APPROVAL_TTL_MINUTES) {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const expiresAt = new Date(now.getTime() + istOffset + minutesFromNow * 60 * 1000);
  return expiresAt.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
}

/** Optional whole number. Blank stays empty. */
export function normalizeSeatingCount(raw) {
  if (raw == null || String(raw).trim() === '') return { value: null };
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return { error: 'No. of seating must be a whole number' };
  const count = Number(text);
  if (count > 999) return { error: 'No. of seating cannot be more than 999' };
  return { value: count };
}

export function buildCentreApprovalEmail({ otp, memberName, coachName }) {
  const member = String(memberName || 'A member').replace(/[\r\n]/g, ' ').trim() || 'A member';
  const coach = String(coachName || 'Coach').replace(/[\r\n]/g, ' ').trim() || 'Coach';
  const code = String(otp || '').trim();
  const text = [
    `Hello ${coach},`,
    '',
    `${member} wants to register a nutrition centre and needs your approval.`,
    `Approval code: ${code}`,
    `This code expires in ${CENTRE_APPROVAL_TTL_MINUTES} minutes.`,
    'Share it only with that member.',
  ].join('\n');
  const html = `<p>Hello ${escapeHtml(coach)},</p>
<p>${escapeHtml(member)} wants to register a nutrition centre and needs your approval.</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${escapeHtml(code)}</p>
<p>This code expires in ${CENTRE_APPROVAL_TTL_MINUTES} minutes. Share it only with that member.</p>`;
  return {
    subject: 'Nutrition centre approval code',
    text,
    html,
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
