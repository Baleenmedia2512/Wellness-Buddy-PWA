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
 * @param {{
 *   otp: string,
 *   currentHeightCm?: number|null,
 *   newHeightCm?: number|null,
 *   expiresMinutes?: number,
 * }} input
 */
export function buildHeightChangeOtpEmail({
  otp,
  currentHeightCm = null,
  newHeightCm = null,
  expiresMinutes = 5,
} = {}) {
  const code = String(otp || '').trim();
  const currentLabel = Number.isFinite(Number(currentHeightCm))
    ? `${Number(currentHeightCm)} cm`
    : null;
  const newLabel = Number.isFinite(Number(newHeightCm))
    ? `${Number(newHeightCm)} cm`
    : null;

  let requestLine;
  if (currentLabel && newLabel) {
    requestLine = `You requested to change your height. Current height: ${currentLabel}. New height: ${newLabel}.`;
  } else if (newLabel) {
    requestLine = `You requested to change your height to ${newLabel}.`;
  } else {
    requestLine = 'You requested to change your height.';
  }

  const subject = 'Wellness Valley — confirm height change';
  const text = [
    'Wellness Valley',
    '',
    requestLine,
    `Enter this code in the app. It expires in ${expiresMinutes} minutes.`,
    `Code: ${code}`,
    '',
    'If you did not request this, you can ignore this message.',
  ].join('\n');

  let requestHtml;
  if (currentLabel && newLabel) {
    requestHtml = `You requested to change your height. Current height: <strong>${escapeHtml(currentLabel)}</strong>. New height: <strong>${escapeHtml(newLabel)}</strong>.`;
  } else if (newLabel) {
    requestHtml = `You requested to change your height to <strong>${escapeHtml(newLabel)}</strong>.`;
  } else {
    requestHtml = 'You requested to change your height.';
  }

  const html = wrapHtml(
    `<p>Wellness Valley</p>`
    + `<p>${requestHtml}</p>`
    + `<p>Enter this code in the app. It expires in ${expiresMinutes} minutes.</p>`
    + `<p>Code: <strong>${escapeHtml(code)}</strong></p>`
    + `<p>If you did not request this, you can ignore this message.</p>`,
  );
  return { subject, text, html };
}
