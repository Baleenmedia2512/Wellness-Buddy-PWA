/**
 * Member email copy for upline website display consent OTP.
 */
import { WEBSITE_DISPLAY_OTP_HOURS } from './websiteDisplayConsent.rules.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{
 *   otp: string,
 *   memberName?: string,
 *   expiresHours?: number,
 * }} input
 */
export function buildWebsiteDisplayConsentEmail({
  otp,
  memberName = 'Member',
  expiresHours = WEBSITE_DISPLAY_OTP_HOURS,
} = {}) {
  const hours = Number(expiresHours) > 0 ? Number(expiresHours) : WEBSITE_DISPLAY_OTP_HOURS;
  const name = String(memberName || 'Member').trim() || 'Member';
  const code = String(otp || '').trim();
  const subject = 'Confirm: show your Transformation on upline websites';
  const text = [
    `Hi ${name},`,
    '',
    'You agreed to display your Transformation on websites for all your Uplines.',
    `Enter this ${code.length}-digit code in the app to confirm:`,
    '',
    code,
    '',
    `This code expires in ${hours} hour(s).`,
    '',
    'If you did not request this, ignore this email — nothing will be shown on websites.',
    '',
    '— Wellness Valley',
  ].join('\n');

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#0f172a;line-height:1.5">
  <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
  <p>You agreed to display your Transformation on websites for <strong>all your Uplines</strong>.</p>
  <p>Enter this code in the app to confirm:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:0.35em;margin:16px 0">${escapeHtml(code)}</p>
  <p style="color:#64748b;font-size:13px">Expires in ${hours} hour(s). If you did not request this, ignore this email.</p>
  <p style="color:#94a3b8;font-size:12px">— Wellness Valley</p>
</body></html>`;

  return { subject, text, html };
}
