/**
 * Entry check-in misuse report email — pure template, no I/O.
 * Sent to the guest and their coach when staff taps Report.
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
 *   reportedByName?: string,
 *   recipientRole?: 'guest'|'coach',
 * }} input
 */
export function buildCheckInMisuseReportEmail({
  guestName = '',
  eventName = '',
  ticketNumber = '',
  reportedByName = '',
  recipientRole = 'guest',
} = {}) {
  const guest = cleanText(guestName, 'Guest');
  const event = cleanText(eventName, 'an event');
  const ticket = cleanText(ticketNumber, '');
  const reporter = cleanText(reportedByName, 'event staff');
  const isCoach = String(recipientRole || 'guest').toLowerCase() === 'coach';

  const safeGuest = escapeHtml(guest);
  const safeEvent = escapeHtml(event);
  const safeTicket = escapeHtml(ticket);
  const safeReporter = escapeHtml(reporter);

  const subject = `Account use alert — ${event}`;
  const greetingText = isCoach ? 'Hello,' : `Hi ${guest},`;
  const intro = isCoach
    ? `A check-in report was raised for your downline member <strong>${safeGuest}</strong>.`
    : 'Someone is trying to use your account at event check-in.';
  const introText = isCoach
    ? `A check-in report was raised for your downline member ${guest}.`
    : 'Someone is trying to use your account at event check-in.';

  const text = [
    greetingText,
    '',
    introText,
    `Event: ${event}`,
    ticket ? `Ticket number: ${ticket}` : null,
    `Reported by: ${reporter}`,
    '',
    'If this was not you, please contact your coach or Wellness Valley support.',
    '',
    '— Wellness Valley',
  ].filter((line) => line != null).join('\n');

  const ticketRow = ticket
    ? `<p style="margin:12px 0 0;font-size:14px;color:#7f1d1d;"><strong>Ticket number:</strong> ${safeTicket}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #fecaca;">
          <tr>
            <td style="background:#991b1b;padding:20px 24px;color:#ffffff;">
              <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.9;">Wellness Valley</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Account use alert</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0;font-size:16px;color:#111827;">${isCoach ? 'Hello,' : `Hi <strong>${safeGuest}</strong>,`}</p>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.5;color:#374151;">
                ${intro}
              </p>
              <p style="margin:12px 0 0;font-size:14px;color:#7f1d1d;">
                <strong>Event:</strong> ${safeEvent}
              </p>
              ${ticketRow}
              <p style="margin:12px 0 0;font-size:14px;color:#7f1d1d;">
                <strong>Reported by:</strong> ${safeReporter}
              </p>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">
                If this was not you, please contact your coach or Wellness Valley support.
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
