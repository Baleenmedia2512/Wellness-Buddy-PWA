/**
 * Guest check-in verified email — pure template, no I/O.
 * Sent when a designated checker marks the guest Verified.
 */

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

/**
 * @param {{
 *   guestName?: string,
 *   eventName?: string,
 *   ticketNumber?: string,
 *   verifierName?: string,
 *   verifierCommunityId?: string,
 *   checkInType?: 'entry'|'food',
 * }} input
 */
export function buildCheckInVerifiedEmail({
  guestName = '',
  eventName = '',
  ticketNumber = '',
  verifierName = '',
  verifierCommunityId = '',
  checkInType = 'entry',
} = {}) {
  const isFood = String(checkInType || 'entry').toLowerCase() === 'food';
  const guest = cleanText(guestName, 'Guest');
  const event = cleanText(eventName, 'your event');
  const ticket = cleanText(ticketNumber, '');
  const verifier = cleanText(verifierName, 'Wellness Valley team');
  const verifierId = cleanText(verifierCommunityId, '');
  const verifierLabel = verifierId ? `${verifier} (${verifierId})` : verifier;

  const safeGuest = escapeHtml(guest);
  const safeEvent = escapeHtml(event);
  const safeTicket = escapeHtml(ticket);
  const safeVerifier = escapeHtml(verifierLabel);

  const headline = isFood ? 'Food successfully verified' : 'Successfully verified';
  const bodyLine = isFood
    ? `Your food has been successfully verified for <strong>${safeEvent}</strong>.`
    : `You have been successfully verified for <strong>${safeEvent}</strong>.`;
  const bodyLineText = isFood
    ? `Your food has been successfully verified for ${event}.`
    : `You have been successfully verified for ${event}.`;
  const footerHint = isFood
    ? 'Please show this confirmation at the food counter if asked.'
    : 'Please show this confirmation at the entrance if asked.';

  const subject = isFood
    ? `Food successfully verified — ${event}`
    : `Successfully verified — ${event}`;
  const text = [
    `Hi ${guest},`,
    '',
    bodyLineText,
    ticket ? `Ticket number: ${ticket}` : null,
    `Verified by: ${verifierLabel}`,
    '',
    footerHint,
    '',
    '— Wellness Valley',
  ].filter((line) => line != null).join('\n');

  const ticketRow = ticket
    ? `<p style="margin:12px 0 0;font-size:14px;color:#065f46;"><strong>Ticket number:</strong> ${safeTicket}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d1fae5;">
          <tr>
            <td style="background:#065f46;padding:20px 24px;color:#ffffff;">
              <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.9;">Wellness Valley</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">${headline}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0;font-size:16px;color:#111827;">Hi <strong>${safeGuest}</strong>,</p>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.5;color:#374151;">
                ${bodyLine}
              </p>
              ${ticketRow}
              <p style="margin:12px 0 0;font-size:14px;color:#065f46;">
                <strong>Verified by:</strong> ${safeVerifier}
              </p>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">
                ${footerHint}
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
