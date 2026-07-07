/**
 * Coach verification email for member testimonials.
 *
 * Encoding note: never use emoji or non-ASCII punctuation in email HTML/subject.
 * UTF-8 multi-byte chars (emoji, en-dash) render as mojibake (e.g. ðŸŒ¿, â€")
 * when clients or SMTP treat the message as Latin-1/Windows-1252.
 * Use ASCII-only copy and explicit charset in nodemailer sendMail().
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return escapeHtml(value);
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function formatOtpDisplay(otp) {
  return escapeHtml(String(otp ?? '')).split('').join(' ');
}

function weightChangeKg(beforeWeight, afterWeight) {
  return Math.abs(Number(afterWeight) - Number(beforeWeight));
}

function buildProgressSentence(memberName, goalType, beforeWeight, afterWeight, durationText) {
  const weightStr = formatWeight(weightChangeKg(beforeWeight, afterWeight));
  const verb = goalType === 'loss' ? 'lost' : 'gained';
  return `${escapeHtml(memberName)} has ${verb} ${weightStr} kg in ${escapeHtml(durationText)}.`;
}

function buildProgressSentencePlain(memberName, goalType, beforeWeight, afterWeight, durationText) {
  const n = weightChangeKg(beforeWeight, afterWeight);
  const weightStr = n % 1 === 0 ? String(n) : n.toFixed(1);
  const verb = goalType === 'loss' ? 'lost' : 'gained';
  return `${memberName} has ${verb} ${weightStr} kg in ${durationText}.`;
}

/** Equal-size metric card. ASCII labels only. */
function buildMetricCard(label, value, width) {
  return `
    <td width="${width}" valign="top" style="padding:0 3px 4px 3px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" valign="middle" height="64" style="height:64px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 4px;">
            <p style="margin:0;color:#6b7280;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;font-family:Arial,Helvetica,sans-serif;line-height:1.2;">${label}</p>
            <p style="margin:3px 0 0;color:#047857;font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.2;">${value}</p>
          </td>
        </tr>
      </table>
    </td>`;
}

function buildStatsRow(beforeWeight, afterWeight, goalLabel) {
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;">
      <tr>
        ${buildMetricCard('Before', `${formatWeight(beforeWeight)} kg`, '33%')}
        ${buildMetricCard('After', `${formatWeight(afterWeight)} kg`, '33%')}
        ${buildMetricCard('Goal', escapeHtml(goalLabel), '33%')}
      </tr>
    </table>`;
}

function buildPhotosRow(beforeUrl, afterUrl) {
  if (!beforeUrl || !afterUrl) return '';
  const safeBefore = escapeHtml(beforeUrl);
  const safeAfter = escapeHtml(afterUrl);

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;">
      <tr>
        <td width="50%" valign="top" align="center" class="photo-col" style="padding:0 4px 0 0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:6px;">
                <p style="margin:0 0 6px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">Before</p>
                <img src="${safeBefore}" alt="Before" width="260" height="320" class="photo-img" style="display:block;width:260px;max-width:100%;height:320px;margin:0 auto;border:0;border-radius:6px;" />
              </td>
            </tr>
          </table>
        </td>
        <td width="50%" valign="top" align="center" class="photo-col" style="padding:0 0 0 4px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:6px;">
                <p style="margin:0 0 6px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">After</p>
                <img src="${safeAfter}" alt="After" width="260" height="320" class="photo-img" style="display:block;width:260px;max-width:100%;height:320px;margin:0 auto;border:0;border-radius:6px;" />
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * @param {object} params
 * @returns {string}
 */
export function buildTestimonialCoachEmailHtml({
  memberName,
  goalType,
  beforeWeight,
  afterWeight,
  durationText,
  otp,
  beforeUrl,
  afterUrl,
}) {
  const safeMember = escapeHtml(memberName);
  const safeOtp = formatOtpDisplay(otp);
  const goalLabel = goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';
  const progressHtml = buildProgressSentence(memberName, goalType, beforeWeight, afterWeight, durationText);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Testimonial Verification - Wellness Valley</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <!--[if !mso]><!-->
  <style type="text/css">
    @media only screen and (max-width: 480px) {
      .wrapper { width: 100% !important; }
      .body-pad { padding: 14px 12px !important; }
      .photo-img { width: 100% !important; max-width: 148px !important; height: 190px !important; }
      .header-pad { padding: 14px 12px !important; }
      .footer-pad { padding: 12px !important; }
    }
    @media only screen and (max-width: 360px) {
      .photo-col { display: block !important; width: 100% !important; padding: 0 0 8px 0 !important; }
      .photo-img { max-width: 220px !important; height: 260px !important; }
    }
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;width:100%;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:12px 8px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="wrapper" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">

          <tr>
            <td align="center" class="header-pad" style="background-color:#059669;padding:16px 20px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.2;">Wellness Valley</p>
              <p style="margin:4px 0 0;color:#d1fae5;font-size:12px;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">Member Testimonial Verification</p>
            </td>
          </tr>

          <tr>
            <td class="body-pad" style="padding:16px 20px;">
              <p style="margin:0 0 8px;color:#111827;font-size:16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">Your member has submitted a testimonial</p>
              <p style="margin:0 0 12px;color:#111827;font-size:14px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
                <strong>${progressHtml}</strong>
              </p>
              <p style="margin:0 0 12px;color:#4b5563;font-size:13px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">
                Review the details below and share the OTP with <strong style="color:#111827;">${safeMember}</strong> to verify.
              </p>

              ${buildStatsRow(beforeWeight, afterWeight, goalLabel)}
              ${buildPhotosRow(beforeUrl, afterUrl)}

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px 0;">
                <tr>
                  <td align="center" style="background-color:#f0fdf4;border:2px dashed #6ee7b7;border-radius:8px;padding:14px 12px;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:Arial,Helvetica,sans-serif;">Verification OTP</p>
                    <p style="margin:8px 0 0;color:#047857;font-size:32px;font-weight:700;letter-spacing:6px;font-family:'Courier New',Courier,monospace;line-height:1.1;">${safeOtp}</p>
                    <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Valid for 24 hours</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;">
                    <p style="margin:0 0 4px;color:#92400e;font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">Verification instructions</p>
                    <p style="margin:0;color:#92400e;font-size:12px;line-height:1.45;font-family:Arial,Helvetica,sans-serif;">
                      1. Review the before and after photos.<br />
                      2. Share the OTP with <strong>${safeMember}</strong> if approved.<br />
                      3. Member enters OTP in the Wellness Valley app.<br />
                      4. Do not share the OTP if not approved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" class="footer-pad" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:12px 20px;">
              <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">
                <strong style="color:#374151;">Wellness Valley Team</strong><br />
                Automated message. Do not reply.<br />
                Support: easy2work.india@gmail.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plain-text fallback for clients that do not render HTML.
 */
export function buildTestimonialCoachEmailText({
  memberName,
  goalType,
  beforeWeight,
  afterWeight,
  durationText,
  otp,
}) {
  const goalLabel = goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';
  const progress = buildProgressSentencePlain(memberName, goalType, beforeWeight, afterWeight, durationText);

  return [
    'Wellness Valley - Member Testimonial Verification',
    '',
    `${memberName} has submitted a testimonial.`,
    progress,
    '',
    `Before: ${formatWeight(beforeWeight)} kg | After: ${formatWeight(afterWeight)} kg | Goal: ${goalLabel}`,
    '',
    `Verification OTP: ${String(otp ?? '').split('').join(' ')}`,
    'Valid for 24 hours',
    '',
    'Verification instructions:',
    '1. Review the before and after photos.',
    '2. Share the OTP with your member if approved.',
    '3. Member enters OTP in the Wellness Valley app.',
    '',
    'Wellness Valley Team',
    'Support: easy2work.india@gmail.com',
  ].join('\n');
}

/**
 * @param {object} params
 * @returns {string}
 */
export function buildTestimonialCoachEmailSubject({ memberName }) {
  const safe = String(memberName ?? 'Member').replace(/[\r\n]/g, ' ').trim();
  return `Testimonial submitted by ${safe} - Verification required`;
}
