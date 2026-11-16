/**
 * Event cancellation refund and guest notice. Pure — no I/O.
 * Paid ticket credit is returned once. Saved bookings are told, with no credit.
 */

import { formatWalletAmount } from '../../wallet/domain/wallet.rules.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanText(value, fallback = '') {
  const text = String(value || '').replace(/[\r\n]/g, ' ').trim();
  return text || fallback;
}

function rupeeAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Credit still sitting on a paid registration. Already refunded rows return 0.
 * @param {{ paymentStatus?: string, amountCharged?: unknown }} registration
 * @returns {number}
 */
export function refundableEventTicketAmount(registration) {
  if (String(registration?.paymentStatus || '').toLowerCase() !== 'paid') return 0;
  return rupeeAmount(registration?.amountCharged);
}

/**
 * Amount to mention in the notice after the credit has been returned, or while it is still paid.
 * @param {{ paymentStatus?: string, amountCharged?: unknown }} registration
 * @returns {number}
 */
export function cancelledTicketCreditAmount(registration) {
  const status = String(registration?.paymentStatus || '').toLowerCase();
  if (status !== 'paid' && status !== 'refunded') return 0;
  return rupeeAmount(registration?.amountCharged);
}

/**
 * Unique guest inboxes. Profile email and the email typed at registration both count.
 * @param {...unknown} values
 * @returns {string[]}
 */
export function cancellationNoticeEmails(...values) {
  const seen = new Set();
  const emails = [];
  for (const value of values) {
    const email = String(value || '').trim();
    if (!email.includes('@')) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }
  return emails;
}

/**
 * @param {{
 *   guestName?: string,
 *   eventName?: string,
 *   eventDate?: string,
 *   place?: string,
 *   refundAmount?: number,
 *   ticketNumber?: string,
 * }} input
 */
export function buildEventCancelledNotice({
  guestName = '',
  eventName = '',
  eventDate = '',
  place = '',
  refundAmount = 0,
  ticketNumber = '',
} = {}) {
  const guest = cleanText(guestName, 'Guest');
  const event = cleanText(eventName, 'your event');
  const when = cleanText(eventDate, '');
  const where = cleanText(place, '');
  const ticket = cleanText(ticketNumber, '');
  const credit = rupeeAmount(refundAmount);
  const creditText = credit > 0
    ? `₹${formatWalletAmount(credit)} has been returned to your Wellness Valley wallet.`
    : 'Your booking is cancelled.';

  const subject = `Event cancelled — ${event}`;
  const lines = [
    `Hi ${guest},`,
    '',
    `${event} has been cancelled.`,
    when ? `Date: ${when}` : null,
    where ? `Place: ${where}` : null,
    ticket ? `Ticket: ${ticket}` : null,
    creditText,
    '',
    '— Wellness Valley',
  ].filter((line) => line != null);
  const text = lines.join('\n');

  const safeGuest = escapeHtml(guest);
  const safeEvent = escapeHtml(event);
  const detailRows = [
    when ? `<p style="margin:8px 0 0;font-size:14px;color:#374151;"><strong>Date:</strong> ${escapeHtml(when)}</p>` : '',
    where ? `<p style="margin:8px 0 0;font-size:14px;color:#374151;"><strong>Place:</strong> ${escapeHtml(where)}</p>` : '',
    ticket ? `<p style="margin:8px 0 0;font-size:14px;color:#374151;"><strong>Ticket:</strong> ${escapeHtml(ticket)}</p>` : '',
  ].join('');

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #fecaca;">
          <tr>
            <td style="background:#9f1239;padding:20px 24px;color:#ffffff;">
              <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.9;">Wellness Valley</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Event cancelled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0;font-size:16px;color:#111827;">Hi <strong>${safeGuest}</strong>,</p>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.5;color:#374151;">
                <strong>${safeEvent}</strong> has been cancelled.
              </p>
              ${detailRows}
              <p style="margin:16px 0 0;font-size:15px;line-height:1.5;color:#9f1239;">
                ${escapeHtml(creditText)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html, whatsappText: text };
}

/**
 * Host-facing summary after a cancel settlement. Empty when nothing changed.
 * @param {{ refunded?: number, emailed?: number, whatsappSent?: number, whatsappReady?: number }} input
 * @returns {string}
 */
export function describeCancellationSettlement({
  refunded = 0,
  emailed = 0,
  whatsappSent = 0,
  whatsappReady = 0,
} = {}) {
  const parts = [];
  const credits = Number(refunded) || 0;
  const mails = Number(emailed) || 0;
  const sent = Number(whatsappSent) || 0;
  const ready = Number(whatsappReady) || 0;
  if (credits > 0) {
    parts.push(credits === 1
      ? '1 ticket credit is back in the wallet'
      : `${credits} ticket credits are back in the wallets`);
  }
  if (mails > 0) {
    parts.push(mails === 1
      ? '1 cancellation email was sent'
      : `${mails} cancellation emails were sent`);
  }
  if (sent > 0) {
    parts.push(sent === 1
      ? '1 WhatsApp message was sent'
      : `${sent} WhatsApp messages were sent`);
  } else if (ready > 0) {
    parts.push(ready === 1
      ? 'Tap Send WhatsApp so that guest gets the message'
      : `Tap Send WhatsApp for ${ready} guests so they get the message`);
  }
  if (parts.length === 0) return '';
  return `${parts.join('. ')}.`;
}
