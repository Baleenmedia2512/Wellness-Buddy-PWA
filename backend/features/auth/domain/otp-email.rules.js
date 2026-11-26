/**
 * Transactional OTP email copy — plain text first so Gmail/Inbox
 * treat it as a sign-in message, not marketing.
 * Pure — no I/O.
 */

import {
  buildWhatsAppShareUrl,
  buildWhatsAppShareButtonHtml,
} from '../../../shared/lib/whatsapp-share.rules.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapHtml(bodyInner) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#111111;line-height:1.5;margin:16px">
${bodyInner}
</body>
</html>`;
}

/**
 * Login / onboarding email code.
 * @param {string} otp
 * @param {{ expiresMinutes?: number }} [opts]
 */
export function buildSignInOtpEmail(otp, { expiresMinutes = 5 } = {}) {
  const code = String(otp || '').trim();
  const subject = 'Wellness Valley sign-in code';
  const waUrl = buildWhatsAppShareUrl({
    text: `Your Wellness Valley sign-in code is ${code}.`,
  });
  const whatsappButtonHtml = buildWhatsAppShareButtonHtml({
    shareUrl: waUrl,
    label: `Share code ${code} on WhatsApp`,
  });
  const text = [
    'Wellness Valley',
    '',
    `Your sign-in code is ${code}.`,
    ...(waUrl ? ['', `Share code ${code} on WhatsApp: ${waUrl}`] : []),
    '',
    `This code expires in ${expiresMinutes} minutes.`,
    '',
    `If you did not ask for this code, you can ignore this message. (Ref: #${code})`,
  ].join('\n');
  const html = wrapHtml(
    `<p>Wellness Valley</p>`
    + `<p>Your sign-in code is <strong>${escapeHtml(code)}</strong>.</p>`
    + whatsappButtonHtml
    + `<p style="margin-top:16px">This code expires in ${expiresMinutes} minutes.</p>`
    + `<p style="margin-top:12px;font-size:13px;color:#666666">If you did not ask for this code, you can ignore this message. (Ref: #${escapeHtml(code)})</p>`,
  );
  return { subject, text, html, whatsappUrl: waUrl };
}

/**
 * Sponsor / coach approval code.
 * @param {{ otp: string, memberName?: string, memberPhone?: string, expiresHours?: number }} input
 */
export function buildSponsorOtpEmail({ otp, memberName = '', memberPhone = '', expiresHours = 24 } = {}) {
  const code = String(otp || '').trim();
  const who = String(memberName || 'A member').replace(/[\r\n]/g, ' ').trim() || 'A member';
  const subject = `${who} -Wellness Valley login request`;
  const waUrl = buildWhatsAppShareUrl({
    phone: memberPhone,
    text: `Hi ${who}, your Wellness Valley team code is ${code}.`,
  });
  const whatsappButtonHtml = buildWhatsAppShareButtonHtml({
    shareUrl: waUrl,
    label: `Share code ${code} on WhatsApp`,
  });
  const text = [
    'Wellness Valley',
    '',
    `${who} asked to join your team.`,
    `Your team code is ${code}.`,
    ...(waUrl ? ['', `Share code ${code} on WhatsApp: ${waUrl}`] : []),
    '',
    `Share this code with ${who}. It expires in ${expiresHours} hours.`,
    '',
    `If you were not expecting this request from ${who}, you can ignore this message. (Ref: #${code})`,
  ].join('\n');
  const html = wrapHtml(
    `<p>Wellness Valley</p>`
    + `<p>${escapeHtml(who)} asked to join your team.</p>`
    + `<p>Your team code is <strong>${escapeHtml(code)}</strong>.</p>`
    + whatsappButtonHtml
    + `<p style="margin-top:16px">Share this code with ${escapeHtml(who)}. It expires in ${expiresHours} hours.</p>`
    + `<p style="margin-top:12px;font-size:13px;color:#666666">If you were not expecting this request from ${escapeHtml(who)}, you can ignore this message. (Ref: #${escapeHtml(code)})</p>`,
  );
  return { subject, text, html, whatsappUrl: waUrl };
}
