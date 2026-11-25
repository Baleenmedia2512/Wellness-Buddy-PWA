/**
 * Unified profile-change approval email — sent to the member's coach (CoachId).
 * Pure — no I/O.
 */
import {
  buildWhatsAppShareUrl,
  buildWhatsAppShareButtonHtml,
} from '../../../shared/lib/whatsapp-share.rules.js';
import { labelsForChangedKeys } from './profileChange.rules.js';

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

function cleanName(value, fallback) {
  const who = String(value || fallback).replace(/[\r\n]/g, ' ').trim();
  return who || fallback;
}

/**
 * @param {{
 *   otp: string,
 *   memberName?: string,
 *   memberPhone?: string,
 *   changedKeys?: string[],
 *   expiresHours?: number,
 * }} input
 */
export function buildProfileChangeOtpEmail({
  otp,
  memberName = '',
  memberPhone = '',
  changedKeys = [],
  expiresHours = 24,
} = {}) {
  const code = String(otp || '').trim();
  const who = cleanName(memberName, 'A member');
  const labels = labelsForChangedKeys(changedKeys);
  const fieldList = labels.length > 0 ? labels.join(', ') : 'profile details';
  const requestLine = `${who} wants to update: ${fieldList}.`;
  const subject = `${who} - profile change approval`;
  const waUrl = buildWhatsAppShareUrl({
    phone: memberPhone,
    text: `Hi ${who}, your Wellness Valley profile change approval code is ${code}.`,
  });
  const whatsappButtonHtml = buildWhatsAppShareButtonHtml({
    shareUrl: waUrl,
    label: 'Share code on WhatsApp',
  });
  const text = [
    'Wellness Valley',
    '',
    requestLine,
    `Share this approval code with them. It expires in ${expiresHours} hours.`,
    `Approval code: ${code}`,
  ].join('\n');

  const html = wrapHtml(`
<p style="margin:0 0 12px"><strong>Wellness Valley</strong></p>
<p style="margin:0 0 12px">${escapeHtml(requestLine)}</p>
<p style="margin:0 0 12px">Share this approval code with them. It expires in ${expiresHours} hours.</p>
<p style="margin:0 0 16px;font-size:28px;letter-spacing:4px;font-weight:bold">${escapeHtml(code)}</p>
${whatsappButtonHtml || ''}
`);

  return { subject, text, html };
}
