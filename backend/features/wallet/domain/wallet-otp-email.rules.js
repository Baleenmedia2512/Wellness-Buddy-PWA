/**
 * Wallet cash-in OTP email — sent to the selected Wellness Valley person's
 * profile email. Pure — no I/O. Wallet-only; other mail templates are unchanged.
 *
 * Look: green approval template. Copy: only the four simple lines.
 */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanName(value, fallback) {
  const who = String(value || fallback).replace(/[\r\n]/g, ' ').trim();
  return who || fallback;
}

function formatOtpDisplay(otp) {
  return escapeHtml(String(otp || '')).split('').join(' ');
}

/**
 * @param {{ otp: string, requesterName?: string, amountLabel?: string, expiresMinutes?: number }} input
 */
export function buildWalletCashOtpEmail({
  otp,
  requesterName = '',
  amountLabel = '',
  expiresMinutes = 30,
} = {}) {
  const code = String(otp || '').trim();
  const who = cleanName(requesterName, 'A member');
  const amount = cleanName(amountLabel, 'an amount');
  const minutes = Number(expiresMinutes) || 30;
  const safeWho = escapeHtml(who);
  const safeAmount = escapeHtml(amount);
  const subject = `${who} - Wellness Valley wallet approval`;
  const text = [
    'Wellness Valley',
    '',
    `${who} wants to add ₹${amount} to their Wellness Valley wallet.`,
    '',
    `Share this 4-digit code with them. It expires in ${minutes} minutes.`,
    '',
    `Approval code: ${code}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Wellness Valley</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;margin:0;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td style="background-color:#15803d;border-radius:16px 16px 0 0;padding:28px 28px 24px 28px;text-align:left;">
              <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#bbf7d0;">Wellness Valley</p>
              <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;">Wallet approval code</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 18px 0;font-size:16px;line-height:1.5;color:#111827;">
                ${safeWho} wants to add ₹${safeAmount} to their Wellness Valley wallet.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 18px;">
                    <p style="margin:0 0 4px 0;font-size:12px;color:#166534;">Amount</p>
                    <p style="margin:0;font-size:28px;line-height:1.2;font-weight:700;color:#14532d;">₹${safeAmount}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px 0;font-size:14px;color:#374151;text-align:center;">Approval code</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
                <tr>
                  <td align="center" style="background-color:#14532d;border-radius:12px;padding:18px 12px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:1;letter-spacing:0.28em;font-weight:700;color:#ffffff;">
                      ${formatOtpDisplay(code)}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#374151;text-align:center;">
                Share this 4-digit code with them. It expires in ${minutes} minutes.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
