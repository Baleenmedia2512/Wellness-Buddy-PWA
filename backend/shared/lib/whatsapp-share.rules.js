/**
 * WhatsApp share URL and email button builders for verification code emails.
 * Pure — no I/O.
 *
 * Allows coaches and members to easily tap a button or link in an email
 * to share their verification code via WhatsApp.
 */

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalises phone number for WhatsApp links (India 10-digit → 91…).
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
 * Builds a WhatsApp share URL.
 * When a valid phone number is supplied, links directly to chat with that number (wa.me/digits?text=...).
 * When no phone number is supplied, links to universal WhatsApp send (api.whatsapp.com/send?text=...),
 * allowing the user to select any contact or group in WhatsApp.
 *
 * @param {{ phone?: string|null, text: string }} input
 * @returns {string}
 */
export function buildWhatsAppShareUrl({ phone = null, text = '' } = {}) {
  const digits = normalizeWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(String(text || '').trim());
  if (digits) {
    return `https://wa.me/${digits}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Builds an email-compatible HTML button for sharing on WhatsApp.
 *
 * @param {{
 *   shareUrl: string,
 *   label?: string,
 *   buttonColor?: string,
 * }} options
 * @returns {string}
 */
export function buildWhatsAppShareButtonHtml({
  shareUrl,
  label = 'Share code on WhatsApp',
  buttonColor = '#16a34a',
} = {}) {
  if (!shareUrl) return '';
  const safeUrl = escapeHtml(shareUrl);
  const safeLabel = escapeHtml(label);
  const safeColor = escapeHtml(buttonColor);

  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0 0;">
                <tr>
                  <td align="center">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;background-color:${safeColor};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.2;text-decoration:none;border-radius:8px;padding:12px 20px;text-align:center;">
                      ${safeLabel}
                    </a>
                  </td>
                </tr>
              </table>`;
}

