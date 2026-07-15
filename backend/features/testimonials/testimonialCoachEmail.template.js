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

function buildHealthIssuesRow(issues) {
  if (!Array.isArray(issues) || issues.length === 0) return '';
  const pills = issues.map((issue) => {
    const safe = escapeHtml(issue);
    return `<span style="display:inline-block;margin:0 4px 4px 0;padding:4px 10px;background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:9999px;color:#047857;font-size:11px;font-weight:600;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">${safe}</span>`;
  }).join('');

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;">
      <tr>
        <td style="background-color:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:10px 12px;">
          <p style="margin:0 0 6px;color:#9f1239;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">Recovered Health Issues</p>
          <p style="margin:0;line-height:1.6;">${pills}</p>
        </td>
      </tr>
    </table>`;
}

function formatHealthIssuesPlain(issues) {
  if (!Array.isArray(issues) || issues.length === 0) return '';
  return issues.map((issue) => String(issue ?? '').trim()).filter(Boolean).join(', ');
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
  recoveredHealthIssues,
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
              ${buildHealthIssuesRow(recoveredHealthIssues)}

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
                      1. Review the before and after photos and recovered health issues.<br />
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
  recoveredHealthIssues,
}) {
  const goalLabel = goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';
  const progress = buildProgressSentencePlain(memberName, goalType, beforeWeight, afterWeight, durationText);
  const issuesPlain = formatHealthIssuesPlain(recoveredHealthIssues);

  return [
    'Wellness Valley - Member Testimonial Verification',
    '',
    `${memberName} has submitted a testimonial.`,
    progress,
    '',
    `Before: ${formatWeight(beforeWeight)} kg | After: ${formatWeight(afterWeight)} kg | Goal: ${goalLabel}`,
    ...(issuesPlain ? ['', `Recovered Health Issues: ${issuesPlain}`] : []),
    '',
    `Verification OTP: ${String(otp ?? '').split('').join(' ')}`,
    'Valid for 24 hours',
    '',
    'Verification instructions:',
    '1. Review the before and after photos and recovered health issues.',
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

// ─── Video email ──────────────────────────────────────────────────────────────

/**
 * Build a CTA "Watch Video" button cell for emails.
 * Email clients do not support <video> — a button linking to the signed URL is the standard approach.
 * @param {string} label   - e.g. "Watch Health Results Video"
 * @param {string} url     - signed URL
 * @param {string} accent  - hex colour
 */
function buildVideoButton(label, url, accent) {
  const safeUrl   = escapeHtml(url);
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td align="center" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 12px;">
          <p style="margin:0 0 8px;color:#374151;font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${safeLabel}</p>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${accent}" style="border-radius:6px;background-color:${accent};">
                <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-block;padding:10px 24px;color:#ffffff;font-size:13px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-decoration:none;line-height:1;">
                  &#9654; Watch Video
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:10px;font-family:Arial,Helvetica,sans-serif;">Link valid for 7 days. Opens in browser.</p>
        </td>
      </tr>
    </table>`;
}

/**
 * Build the full HTML email for video testimonial coach verification.
 * @param {object} params
 * @param {string}      params.memberName
 * @param {string}      params.otp
 * @param {string|null} params.healthVideoUrl    - 7-day signed URL or null
 * @param {string|null} params.businessVideoUrl  - 7-day signed URL or null
 * @returns {string}
 */
export function buildVideoCoachEmailHtml({ memberName, otp, healthVideoUrl, businessVideoUrl, recoveredHealthIssues }) {
  const safeMember = escapeHtml(memberName);
  const safeOtp    = formatOtpDisplay(otp);

  const videoButtons = [
    healthVideoUrl   ? buildVideoButton('Health Results Video (up to 1 min)',   healthVideoUrl,   '#059669') : '',
    businessVideoUrl ? buildVideoButton('Business Results Video (up to 2 min)', businessVideoUrl, '#2563eb') : '',
  ].join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Video Testimonial Verification - Wellness Valley</title>
  <!--[if mso]>
  <style type="text/css">body, table, td { font-family: Arial, Helvetica, sans-serif !important; }</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;width:100%;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:12px 8px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="width:560px;max-width:560px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">

          <tr>
            <td align="center" style="background-color:#059669;padding:16px 20px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.2;">Wellness Valley</p>
              <p style="margin:4px 0 0;color:#d1fae5;font-size:12px;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">Member Video Testimonial Verification</p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 8px;color:#111827;font-size:16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">New result video(s) from ${safeMember}</p>
              <p style="margin:0 0 14px;color:#4b5563;font-size:13px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
                Watch the video(s) below. If approved, share the OTP with <strong style="color:#111827;">${safeMember}</strong> to verify the upload.
              </p>

              ${videoButtons}
              ${buildHealthIssuesRow(recoveredHealthIssues)}

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0 10px;">
                <tr>
                  <td align="center" style="background-color:#f0fdf4;border:2px dashed #6ee7b7;border-radius:8px;padding:14px 12px;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:Arial,Helvetica,sans-serif;">Video Verification OTP</p>
                    <p style="margin:8px 0 0;color:#047857;font-size:32px;font-weight:700;letter-spacing:6px;font-family:'Courier New',Courier,monospace;line-height:1.1;">${safeOtp}</p>
                    <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Valid for 24 hours</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;">
                    <p style="margin:0 0 4px;color:#92400e;font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Verification instructions</p>
                    <p style="margin:0;color:#92400e;font-size:12px;line-height:1.45;font-family:Arial,Helvetica,sans-serif;">
                      1. Click the button(s) above to watch the video(s) and review recovered health issues.<br />
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
            <td align="center" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:12px 20px;">
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
 * Plain-text fallback for the video coach email.
 */
export function buildVideoCoachEmailText({ memberName, otp, healthVideoUrl, businessVideoUrl, recoveredHealthIssues }) {
  const issuesPlain = formatHealthIssuesPlain(recoveredHealthIssues);
  const lines = [
    'Wellness Valley - Video Testimonial Verification',
    '',
    `${memberName} has uploaded result video(s).`,
    '',
  ];
  if (healthVideoUrl)   lines.push(`Watch Health Results Video:`, healthVideoUrl, '');
  if (businessVideoUrl) lines.push(`Watch Business Results Video:`, businessVideoUrl, '');
  if (issuesPlain)      lines.push(`Recovered Health Issues: ${issuesPlain}`, '');
  lines.push(
    `Video Verification OTP: ${String(otp ?? '').split('').join(' ')}`,
    'Valid for 24 hours',
    '',
    'Verification instructions:',
    '1. Watch the video(s) using the link(s) above.',
    `2. Share the OTP with ${memberName} if approved.`,
    '3. Member enters OTP in the Wellness Valley app.',
    '',
    'Wellness Valley Team',
    'Support: easy2work.india@gmail.com',
  );
  return lines.join('\n');
}

/**
 * Subject line for the video coach email.
 */
export function buildVideoCoachEmailSubject({ memberName }) {
  const safe = String(memberName ?? 'Member').replace(/[\r\n]/g, ' ').trim();
  return `Video testimonial from ${safe} - Verification required`;
}

// ─── Unified edit email (submit-all-edits) ────────────────────────────────────

const SLOT_LABELS = {
  before:   'Before photo',
  after:    'After photo',
  health:   'Health Results Video',
  business: 'Business Results Video',
  issues:   'Recovered health issues',
};

/**
 * "WHAT CHANGED" summary block — bold list of updated items.
 */
function buildChangedSlotsBlock(changedSlots) {
  if (!Array.isArray(changedSlots) || changedSlots.length === 0) return '';
  const rows = changedSlots
    .map((s) => SLOT_LABELS[s] || s)
    .map((label) => `<li style="margin:0 0 4px;color:#065f46;font-size:13px;font-family:Arial,Helvetica,sans-serif;font-weight:600;line-height:1.4;">${escapeHtml(label)}</li>`)
    .join('');

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;">
      <tr>
        <td style="background-color:#ecfdf5;border:2px solid #6ee7b7;border-radius:8px;padding:10px 14px;">
          <p style="margin:0 0 6px;color:#047857;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:Arial,Helvetica,sans-serif;">WHAT CHANGED</p>
          <ul style="margin:0;padding:0 0 0 14px;">${rows}</ul>
        </td>
      </tr>
    </table>`;
}

/**
 * Shows a single photo with label. Renders "First Upload" placeholder when no previous URL.
 */
function buildSinglePhotoCell(url, label, isFirst) {
  if (!url) return '';
  const safeUrl = escapeHtml(url);
  if (isFirst) {
    return `
      <td width="50%" valign="top" align="center" class="photo-col" style="padding:0 3px 0 3px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:6px;">
              <p style="margin:0 0 6px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</p>
              <img src="${safeUrl}" alt="${escapeHtml(label)}" width="260" height="320" class="photo-img" style="display:block;width:260px;max-width:100%;height:320px;margin:0 auto;border:0;border-radius:6px;" />
            </td>
          </tr>
        </table>
      </td>`;
  }
  return `
    <td width="50%" valign="top" align="center" class="photo-col" style="padding:0 3px 0 3px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:6px;">
            <p style="margin:0 0 6px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</p>
            <img src="${safeUrl}" alt="${escapeHtml(label)}" width="260" height="320" class="photo-img" style="display:block;width:260px;max-width:100%;height:320px;margin:0 auto;border:0;border-radius:6px;" />
          </td>
        </tr>
      </table>
    </td>`;
}

/**
 * Photo diff row: Previous → New (or "First Upload → New" when previousUrl is null).
 * Only renders if newUrl is present.
 */
function buildPhotoDiffBlock(previousUrl, newUrl, slotLabel, isFirstUpload) {
  if (!newUrl) return '';

  const prevCell = isFirstUpload
    ? `
      <td width="44%" valign="top" align="center" style="padding:0 0 0 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" valign="middle" height="180" style="background-color:#f3f4f6;border:1px dashed #d1d5db;border-radius:8px;padding:8px;">
              <p style="margin:0;color:#9ca3af;font-size:11px;font-family:Arial,Helvetica,sans-serif;font-weight:600;">First Upload</p>
              <p style="margin:4px 0 0;color:#d1d5db;font-size:10px;font-family:Arial,Helvetica,sans-serif;">No previous photo</p>
            </td>
          </tr>
        </table>
      </td>`
    : (previousUrl
      ? `
      <td width="44%" valign="top" align="center" style="padding:0 0 0 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:4px;">
              <p style="margin:0 0 4px;color:#9ca3af;font-size:9px;font-weight:700;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">PREVIOUS</p>
              <img src="${escapeHtml(previousUrl)}" alt="Previous ${escapeHtml(slotLabel)}" width="200" height="250" class="photo-img" style="display:block;width:200px;max-width:100%;height:250px;margin:0 auto;border:0;border-radius:4px;opacity:0.6;" />
            </td>
          </tr>
        </table>
      </td>`
      : '');

  const arrowCell = `
    <td width="12%" valign="middle" align="center" style="padding:0 2px;font-size:18px;color:#059669;font-family:Arial,Helvetica,sans-serif;font-weight:700;">&#8594;</td>`;

  const newCell = `
    <td width="44%" valign="top" align="center" style="padding:0 0 0 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:4px;">
            <p style="margin:0 0 4px;color:#047857;font-size:9px;font-weight:700;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">NEW</p>
            <img src="${escapeHtml(newUrl)}" alt="New ${escapeHtml(slotLabel)}" width="200" height="250" class="photo-img" style="display:block;width:200px;max-width:100%;height:250px;margin:0 auto;border:0;border-radius:4px;" />
          </td>
        </tr>
      </table>
    </td>`;

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px 0;">
      <tr>
        <td>
          <p style="margin:0 0 6px;color:#374151;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(slotLabel)}</p>
        </td>
      </tr>
      <tr>
        ${prevCell}
        ${arrowCell}
        ${newCell}
      </tr>
    </table>`;
}

/**
 * Video updated indicator row for the email.
 */
function buildVideoUpdatedRow(label, url, accent) {
  if (!url) return '';
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;">
      <tr>
        <td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;">
          <p style="margin:0 0 6px;color:#374151;font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</p>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${accent}" style="border-radius:5px;background-color:${accent};">
                <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-block;padding:8px 20px;color:#ffffff;font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-decoration:none;line-height:1;">
                  &#9654; Watch New Video
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:6px 0 0;color:#9ca3af;font-size:10px;font-family:Arial,Helvetica,sans-serif;">Link valid for 7 days.</p>
        </td>
      </tr>
    </table>`;
}

/**
 * Build the full HTML email for the unified submit-all-edits coach verification.
 *
 * @param {object}   params
 * @param {string}   params.memberName
 * @param {string}   params.otp
 * @param {string[]} params.changedSlots          - e.g. ['before', 'after', 'health']
 * @param {string}   params.goalType
 * @param {number}   params.beforeWeight
 * @param {number}   params.afterWeight
 * @param {string}   params.durationText
 * @param {string|null} params.beforeUrl          - new before photo signed URL
 * @param {string|null} params.afterUrl           - new after photo signed URL
 * @param {string|null} params.previousBeforeUrl  - old before photo URL (null = first upload)
 * @param {string|null} params.previousAfterUrl   - old after photo URL (null = first upload)
 * @param {string|null} params.healthVideoUrl     - new health video signed URL
 * @param {string|null} params.businessVideoUrl   - new business video signed URL
 * @param {string[]}    params.recoveredHealthIssues
 * @param {boolean}     params.isComplete         - true if testimonial has both photos
 */
export function buildUnifiedSubmitEmailHtml({
  memberName,
  otp,
  changedSlots,
  goalType,
  beforeWeight,
  afterWeight,
  durationText,
  beforeUrl,
  afterUrl,
  previousBeforeUrl,
  previousAfterUrl,
  healthVideoUrl,
  businessVideoUrl,
  recoveredHealthIssues,
  isComplete,
}) {
  const safeMember = escapeHtml(memberName);
  const safeOtp    = formatOtpDisplay(otp);
  const slots      = new Set(changedSlots || []);

  const goalLabel  = (goalType === 'loss') ? 'Weight Loss' : 'Weight Gain';

  const changedBlock = buildChangedSlotsBlock(changedSlots);

  const beforeDiff = slots.has('before')
    ? buildPhotoDiffBlock(previousBeforeUrl, beforeUrl, 'Before Photo', !previousBeforeUrl)
    : '';

  const afterDiff = slots.has('after')
    ? buildPhotoDiffBlock(previousAfterUrl, afterUrl, 'After Photo', !previousAfterUrl)
    : '';

  const currentPhotosBlock = (isComplete && beforeUrl && afterUrl && !slots.has('before') && !slots.has('after'))
    ? buildPhotosRow(beforeUrl, afterUrl)
    : '';

  const healthVideoBlock   = slots.has('health')   ? buildVideoUpdatedRow('Health Results Video — Updated',   healthVideoUrl,   '#059669') : '';
  const businessVideoBlock = slots.has('business') ? buildVideoUpdatedRow('Business Results Video — Updated', businessVideoUrl, '#2563eb') : '';

  const statsBlock = (isComplete && beforeWeight && afterWeight)
    ? buildStatsRow(beforeWeight, afterWeight, goalLabel)
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Testimonial Updates - Wellness Valley</title>
  <!--[if mso]>
  <style type="text/css">body, table, td { font-family: Arial, Helvetica, sans-serif !important; }</style>
  <![endif]-->
  <!--[if !mso]><!-->
  <style type="text/css">
    @media only screen and (max-width: 480px) {
      .wrapper { width: 100% !important; }
      .body-pad { padding: 14px 12px !important; }
      .photo-img { width: 100% !important; max-width: 140px !important; height: 180px !important; }
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
            <td align="center" style="background-color:#059669;padding:16px 20px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.2;">Wellness Valley</p>
              <p style="margin:4px 0 0;color:#d1fae5;font-size:12px;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">Member Testimonial Updates - Verification Required</p>
            </td>
          </tr>

          <tr>
            <td class="body-pad" style="padding:16px 20px;">
              <p style="margin:0 0 8px;color:#111827;font-size:16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">${safeMember} has submitted updates for approval</p>
              <p style="margin:0 0 14px;color:#4b5563;font-size:13px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
                Review the changes below and share the OTP with <strong style="color:#111827;">${safeMember}</strong> if approved.
              </p>

              ${changedBlock}
              ${statsBlock}
              ${beforeDiff}
              ${afterDiff}
              ${currentPhotosBlock}
              ${healthVideoBlock}
              ${businessVideoBlock}
              ${buildHealthIssuesRow(recoveredHealthIssues)}

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:10px 0;">
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
                    <p style="margin:0 0 4px;color:#92400e;font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Verification instructions</p>
                    <p style="margin:0;color:#92400e;font-size:12px;line-height:1.45;font-family:Arial,Helvetica,sans-serif;">
                      1. Review all the changes listed above.<br />
                      2. Share the OTP with <strong>${safeMember}</strong> if the updates are approved.<br />
                      3. Member enters the OTP in the Wellness Valley app.<br />
                      4. Do not share the OTP if the updates are not approved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:12px 20px;">
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
 * Plain-text fallback for the unified submit email.
 */
export function buildUnifiedSubmitEmailText({
  memberName,
  otp,
  changedSlots,
  goalType,
  beforeWeight,
  afterWeight,
  durationText,
  healthVideoUrl,
  businessVideoUrl,
  recoveredHealthIssues,
  isComplete,
}) {
  const goalLabel   = (goalType === 'loss') ? 'Weight Loss' : 'Weight Gain';
  const issuesPlain = formatHealthIssuesPlain(recoveredHealthIssues);
  const slots       = new Set(changedSlots || []);

  const lines = [
    'Wellness Valley - Member Testimonial Updates',
    '',
    `${memberName} has submitted updates for approval.`,
    '',
    'WHAT CHANGED:',
    ...(changedSlots || []).map((s) => `  - ${SLOT_LABELS[s] || s}`),
    '',
  ];

  if (isComplete && beforeWeight && afterWeight) {
    lines.push(`Before: ${formatWeight(beforeWeight)} kg | After: ${formatWeight(afterWeight)} kg | Goal: ${goalLabel}`);
    if (durationText) lines.push(`Duration: ${durationText}`);
    lines.push('');
  }

  if (slots.has('health') && healthVideoUrl)     lines.push('Health Results Video (new):', healthVideoUrl, '');
  if (slots.has('business') && businessVideoUrl) lines.push('Business Results Video (new):', businessVideoUrl, '');
  if (issuesPlain)                               lines.push(`Recovered Health Issues: ${issuesPlain}`, '');

  lines.push(
    `Verification OTP: ${String(otp ?? '').split('').join(' ')}`,
    'Valid for 24 hours',
    '',
    'Verification instructions:',
    '1. Review all the changes listed above.',
    `2. Share the OTP with ${memberName} if approved.`,
    '3. Member enters the OTP in the Wellness Valley app.',
    '',
    'Wellness Valley Team',
    'Support: easy2work.india@gmail.com',
  );
  return lines.join('\n');
}

/**
 * Subject line for the unified submit email.
 */
export function buildUnifiedSubmitEmailSubject({ memberName }) {
  const safe = String(memberName ?? 'Member').replace(/[\r\n]/g, ' ').trim();
  return `Testimonial updates from ${safe} - Verification required`;
}
