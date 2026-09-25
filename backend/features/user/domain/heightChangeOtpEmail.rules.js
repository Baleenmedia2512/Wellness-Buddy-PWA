/**
 * Height-change OTP email copy — sent to the member's verified email.
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

/**
 * @param {{ otp: string, newHeightCm?: number, expiresMinutes?: number }} input
 */
export function buildHeightChangeOtpEmail({
  otp,
  newHeightCm,
  expiresMinutes = 5,
} = {}) {
  const code = String(otp || '').trim();
  const heightLabel = Number.isFinite(Number(newHeightCm))
    ? `${Number(newHeightCm)} cm`
    : 'a new height';
  const subject = 'Wellness Valley — confirm height change';
  const text = [
    'Wellness Valley',
    '',
    `You requested to change your profile height to ${heightLabel}.`,
    `Enter this code in the app. It expires in ${expiresMinutes} minutes.`,
    `Code: ${code}`,
    '',
    'If you did not request this, you can ignore this message.',
  ].join('\n');
  const html = wrapHtml(
    `<p>Wellness Valley</p>`
    + `<p>You requested to change your profile height to <strong>${escapeHtml(heightLabel)}</strong>.</p>`
    + `<p>Enter this code in the app. It expires in ${expiresMinutes} minutes.</p>`
    + `<p>Code: <strong>${escapeHtml(code)}</strong></p>`
    + `<p>If you did not request this, you can ignore this message.</p>`,
  );
  return { subject, text, html };
}
