/**
 * Community Position approval email — sent to the member's coach (CoachId).
 * Pure — no I/O.
 */

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
 *   positionLabel?: string,
 *   expiresHours?: number,
 * }} input
 */
export function buildCommunityPositionOtpEmail({
  otp,
  memberName = '',
  positionLabel = '',
  expiresHours = 24,
} = {}) {
  const code = String(otp || '').trim();
  const who = cleanName(memberName, 'A member');
  const position = cleanName(positionLabel, 'a community position');
  const subject = `${who} - Community Position approval`;
  const text = [
    'Wellness Valley',
    '',
    `${who} wants the community position ${position}.`,
    `Share this approval code with them. It expires in ${expiresHours} hours.`,
    `Approval code: ${code}`,
    '',
    'If you were not expecting this, you can ignore this message.',
  ].join('\n');
  const html = wrapHtml(
    `<p>Wellness Valley</p>`
    + `<p>${escapeHtml(who)} wants the community position <strong>${escapeHtml(position)}</strong>.</p>`
    + `<p>Share this approval code with them. It expires in ${expiresHours} hours.</p>`
    + `<p>Approval code: <strong>${escapeHtml(code)}</strong></p>`
    + `<p>If you were not expecting this, you can ignore this message.</p>`,
  );
  return { subject, text, html };
}
