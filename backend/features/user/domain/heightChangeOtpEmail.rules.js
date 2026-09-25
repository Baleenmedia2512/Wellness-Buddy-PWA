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
  const fromCm = Number.isFinite(Number(currentHeightCm)) ? Number(currentHeightCm) : null;
  const toCm = Number.isFinite(Number(newHeightCm)) ? Number(newHeightCm) : null;

  let requestLine;
  if (fromCm != null && toCm != null) {
    requestLine = `You requested to change your height from ${fromCm} cm to ${toCm} cm.`;
  } else if (toCm != null) {
    requestLine = `You requested to change your height to ${toCm} cm.`;
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
  if (fromCm != null && toCm != null) {
    requestHtml = `You requested to change your height from <strong>${escapeHtml(`${fromCm} cm`)}</strong> to <strong>${escapeHtml(`${toCm} cm`)}</strong>.`;
  } else if (toCm != null) {
    requestHtml = `You requested to change your height to <strong>${escapeHtml(`${toCm} cm`)}</strong>.`;
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
