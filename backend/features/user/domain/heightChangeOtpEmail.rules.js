/**
 * Height-change approval email — sent to the member's coach (CoachId).
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
 *   currentHeightCm?: number|null,
 *   newHeightCm?: number|null,
 *   expiresHours?: number,
 * }} input
 */
export function buildHeightChangeOtpEmail({
  otp,
  memberName = '',
  currentHeightCm = null,
  newHeightCm = null,
  expiresHours = 24,
} = {}) {
  const code = String(otp || '').trim();
  const who = cleanName(memberName, 'A member');
  const fromCm = Number.isFinite(Number(currentHeightCm)) ? Number(currentHeightCm) : null;
  const toCm = Number.isFinite(Number(newHeightCm)) ? Number(newHeightCm) : null;

  let requestLine;
  if (fromCm != null && toCm != null) {
    requestLine = `${who} wants to change height from ${fromCm} cm to ${toCm} cm.`;
  } else if (toCm != null) {
    requestLine = `${who} wants to change height to ${toCm} cm.`;
  } else {
    requestLine = `${who} wants to change their height.`;
  }

  const subject = `${who} - height change approval`;
  const text = [
    'Wellness Valley',
    '',
    requestLine,
    `Share this approval code with them. It expires in ${expiresHours} hours.`,
    `Approval code: ${code}`,
    '',
    'If you were not expecting this, you can ignore this message.',
  ].join('\n');

  let requestHtml;
  if (fromCm != null && toCm != null) {
    requestHtml = `${escapeHtml(who)} wants to change height from <strong>${escapeHtml(`${fromCm} cm`)}</strong> to <strong>${escapeHtml(`${toCm} cm`)}</strong>.`;
  } else if (toCm != null) {
    requestHtml = `${escapeHtml(who)} wants to change height to <strong>${escapeHtml(`${toCm} cm`)}</strong>.`;
  } else {
    requestHtml = `${escapeHtml(who)} wants to change their height.`;
  }

  const html = wrapHtml(
    `<p>Wellness Valley</p>`
    + `<p>${requestHtml}</p>`
    + `<p>Share this approval code with them. It expires in ${expiresHours} hours.</p>`
    + `<p>Approval code: <strong>${escapeHtml(code)}</strong></p>`
    + `<p>If you were not expecting this, you can ignore this message.</p>`,
  );
  return { subject, text, html };
}
