/**
 * Wallet cash-in OTP email — sent to the selected Wellness Valley person's
 * profile email. Pure — no I/O. Wallet-only; other mail templates are unchanged.
 *
 * Look: green approval template with neat, easy-to-read copy.
 * OTP does not time-expire — valid until Cancel or successful use.
 * Optional WhatsApp button opens chat with the payer and prefills the OTP.
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
 * Digits-only international number for wa.me (India 10-digit → 91…).
 * @param {unknown} phone
 * @returns {string|null}
 */
export function normalizeWhatsAppPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/**
 * Prefills WhatsApp chat with the requester and the approval code.
 * @param {{ phone?: string, otp?: string, amountLabel?: string, requesterName?: string }} input
 * @returns {string|null}
 */
export function buildWalletOtpWhatsAppUrl({
  phone = '',
  otp = '',
  amountLabel = '',
  requesterName = '',
} = {}) {
  const digits = normalizeWhatsAppPhone(phone);
  const code = String(otp || '').trim();
  if (!digits || !code) return null;
  const amount = cleanName(amountLabel, '');
  const who = cleanName(requesterName, 'member');
  const amountPart = amount ? ` for ₹${amount}` : '';
  const text = `Hi ${who}, your Wellness Valley wallet approval code is ${code}${amountPart}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * @param {{ otp: string, requesterName?: string, amountLabel?: string, requesterPhone?: string }} input
 */
export function buildWalletCashOtpEmail({
  otp,
  requesterName = '',
  amountLabel = '',
  requesterPhone = '',
} = {}) {
  const code = String(otp || '').trim();
  const who = cleanName(requesterName, 'A member');
  const amount = cleanName(amountLabel, 'an amount');
  const safeWho = escapeHtml(who);
  const safeAmount = escapeHtml(amount);
  const whatsappUrl = buildWalletOtpWhatsAppUrl({
    phone: requesterPhone,
    otp: code,
    amountLabel: amount,
    requesterName: who,
  });
  const safeWhatsappUrl = whatsappUrl ? escapeHtml(whatsappUrl) : '';
  const subject = `${who} - Wellness Valley wallet approval`;
  const line1 = `${who} has paid you the amount below by CASH, UPI, or CARD.`;
  const line2 = 'If this is correct, please share the approval code below with them.';
  const textLines = [
    'Wellness Valley',
    '',
    line1,
    line2,
    '',
    `Amount: ₹${amount}`,
    '',
    `Approval code: ${code}`,
  ];
  if (whatsappUrl) {
    textLines.push('', `Share on WhatsApp: ${whatsappUrl}`);
  }
  const text = textLines.join('\n');

  const whatsappButtonHtml = whatsappUrl
    ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;">
                <tr>
                  <td align="center">
                    <a href="${safeWhatsappUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;background-color:#16a34a;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.2;text-decoration:none;border-radius:12px;padding:14px 22px;">
                      Share code on WhatsApp
                    </a>
                  </td>
                </tr>
              </table>`
    : '';

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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;border-collapse:separate;">
          <tr>
            <td style="background-color:#15803d;border-radius:16px 16px 0 0;padding:24px 24px 20px 24px;text-align:left;">
              <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#bbf7d0;">Wellness Valley</p>
              <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.25;color:#ffffff;font-weight:700;">Wallet approval code</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:0 0 16px 16px;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.55;color:#111827;">
                <strong style="color:#14532d;">${safeWho}</strong> has paid you the amount below by CASH, UPI, or CARD.
              </p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#374151;">
                If this is correct, please share the approval code below with them.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td align="center" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 16px;">
                    <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#166534;font-family:Arial,Helvetica,sans-serif;">Amount</p>
                    <p style="margin:0;font-size:30px;line-height:1.2;font-weight:700;color:#14532d;font-family:Arial,Helvetica,sans-serif;">₹${safeAmount}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;text-align:center;font-family:Arial,Helvetica,sans-serif;">Approval code</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
                <tr>
                  <td align="center" style="background-color:#14532d;border-radius:12px;padding:20px 12px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:1;letter-spacing:0.32em;font-weight:700;color:#ffffff;">
                      ${formatOtpDisplay(code)}
                    </p>
                  </td>
                </tr>
              </table>
${whatsappButtonHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html, whatsappUrl };
}
