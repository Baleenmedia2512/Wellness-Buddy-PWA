/**
 * Coach website publish verification email (HTML + plain text).
 * Visual language matches Transformation OTP mail: green header, summary, dashed OTP box.
 * Pure — no I/O. ASCII-safe; no emoji.
 */
import { escapeHtml } from './html-escape.js';
import { buildCoachPortfolioPath } from './slug.rules.js';
import { PUBLISH_OTP_HOURS } from './publishOtp.rules.js';
import {
  buildWhatsAppShareUrl,
  buildWhatsAppShareButtonHtml,
} from '../../../shared/lib/whatsapp-share.rules.js';

function cleanLine(value, fallback = '') {
  const text = String(value || '').replace(/[\r\n]+/g, ' ').trim();
  return text || fallback;
}

function hasMedia(value) {
  if (!value) return false;
  if (typeof value === 'string') return Boolean(value.trim());
  if (typeof value === 'object' && value.url) return Boolean(String(value.url).trim());
  return false;
}

function countMediaList(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((item) => hasMedia(item) || (typeof item === 'string' && item.trim())).length;
}

/**
 * @param {object} form
 * @param {{ userId?: number|string, userName?: string }} [opts]
 */
export function buildPublishEmailSummary(form = {}, { userId, userName } = {}) {
  const personal = form.personal || {};
  const center = form.center || {};
  const timings = form.timings || {};
  const services = form.services || {};
  const media = form.mediaBrand || {};

  const path = buildCoachPortfolioPath({
    websiteDisplayName: media.websiteDisplayName,
    fullName: personal.fullName || userName,
    city: center.city,
    locality: center.locality,
    userId,
  });

  const offerings = Array.isArray(services.offerings)
    ? services.offerings.map((o) => cleanLine(typeof o === 'string' ? o : o?.label || o?.name)).filter(Boolean)
    : [];
  const offeringExtra = cleanLine(services.offeringsOther);
  if (offeringExtra) offerings.push(offeringExtra);

  const days = Array.isArray(timings.workingDays) ? timings.workingDays.filter(Boolean) : [];
  const hours = [
    days.length ? days.join(', ') : null,
    timings.openingTime && timings.closingTime
      ? `${cleanLine(timings.openingTime)} - ${cleanLine(timings.closingTime)}`
      : null,
  ].filter(Boolean).join(' | ');

  const title = cleanLine(personal.professionalTitle);
  const titleOther = cleanLine(personal.professionalTitleOther);
  const titleLabel = title === 'Other' && titleOther ? titleOther : title;

  return {
    coachName: cleanLine(personal.fullName || userName, 'Coach'),
    displayName: cleanLine(media.websiteDisplayName, 'coach'),
    fullName: cleanLine(personal.fullName || userName, 'Coach'),
    title: titleLabel,
    city: cleanLine(center.city),
    locality: cleanLine(center.locality),
    centerName: cleanLine(center.centerName),
    businessPhone: cleanLine(center.businessPhone),
    whatsapp: cleanLine(center.whatsapp),
    businessEmail: cleanLine(center.businessEmail),
    hours,
    offerings: offerings.slice(0, 12),
    media: {
      profilePhoto: hasMedia(personal.profilePhoto),
      entrancePhoto: hasMedia(media.entrancePhoto),
      interiorCount: countMediaList(media.interiorPhotos),
      activityCount: countMediaList(media.activityPhotos),
      introVideo: Boolean(
        hasMedia(media.introVideoUrl)
        || cleanLine(media.introVideoLink)
        || cleanLine(media.introVideoKey),
      ),
    },
    publicPath: path.publicPath,
    publicSlug: path.publicSlug,
  };
}

function detailRowsHtml(summary) {
  const place = [summary.city, summary.locality].filter(Boolean).join(', ');
  const mediaBits = [
    summary.media.profilePhoto ? 'Profile photo yes' : 'Profile photo no',
    summary.media.entrancePhoto ? 'Entrance photo yes' : null,
    `Interior ${summary.media.interiorCount} photos`,
    `Activity ${summary.media.activityCount} photos`,
    summary.media.introVideo ? 'Intro video yes' : 'Intro video no',
  ].filter(Boolean).join('; ');

  const rows = [
    ['Display name', summary.displayName],
    ['Full name', summary.fullName],
    ['Title', summary.title],
    ['City / Area', place],
    ['Center', summary.centerName],
    ['Phone', summary.businessPhone],
    ['WhatsApp', summary.whatsapp],
    ['Business email', summary.businessEmail],
    ['Hours', summary.hours],
    ['Offerings', summary.offerings.join(', ')],
    ['Media', mediaBits],
  ].filter(([, v]) => Boolean(String(v || '').trim()));

  return rows.map(([label, value]) => (
    `<tr>
      <td style="padding:4px 0;color:#6b7280;font-size:12px;width:34%;vertical-align:top;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</td>
      <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:600;vertical-align:top;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(value)}</td>
    </tr>`
  )).join('');
}

function spacedOtp(otp) {
  return String(otp || '').trim().split('').join(' ');
}

/**
 * @param {{
 *   otp: string,
 *   form?: object,
 *   userId?: number|string,
 *   userName?: string,
 *   expiresHours?: number,
 *   forCoachApproval?: boolean,
 *   coachName?: string,
 *   memberName?: string,
 *   centerName?: string,
 * }} input
 */
export function buildPublishOtpEmail({
  otp,
  form = {},
  userId,
  userName,
  expiresHours = PUBLISH_OTP_HOURS,
  forCoachApproval = false,
  coachName = '',
  memberName = '',
  memberPhone = '',
  centerName = '',
} = {}) {
  const summary = buildPublishEmailSummary(form, { userId, userName });
  if (centerName) summary.centerName = cleanLine(centerName, summary.centerName);
  const safeOtp = escapeHtml(spacedOtp(otp));
  const member = cleanLine(memberName || summary.fullName || userName, 'A member');
  const safeMember = escapeHtml(member);
  const safePath = escapeHtml(summary.publicPath);
  const safeCenter = escapeHtml(summary.centerName || 'their center');
  const hours = Number(expiresHours) > 0 ? Number(expiresHours) : PUBLISH_OTP_HOURS;

  const rawOtp = String(otp || '').trim();
  const waText = forCoachApproval
    ? `Hi ${member}, your Wellness Valley website publish verification code is ${rawOtp}.`
    : `Your Wellness Valley website publish verification code is ${rawOtp}.`;
  const targetPhone = forCoachApproval
    ? (memberPhone || summary.whatsapp || summary.businessPhone)
    : (summary.whatsapp || summary.businessPhone);
  const whatsappUrl = buildWhatsAppShareUrl({
    phone: targetPhone,
    text: waText,
  });
  const whatsappButtonHtml = buildWhatsAppShareButtonHtml({
    shareUrl: whatsappUrl,
    label: 'Share code on WhatsApp',
  });

  const subject = forCoachApproval
    ? `${member} - website publish verification`
    : 'Coach website publish - verification required';

  const introTitle = forCoachApproval
    ? `${member} requested to publish a website`
    : `${summary.coachName}, you requested to publish your coach website`;
  const introBody = forCoachApproval
    ? `Review the details for <strong style="color:#111827;">${safeCenter}</strong> below. If approved, share the OTP with <strong style="color:#111827;">${safeMember}</strong>.`
    : 'Review the details below, then enter the OTP in the Wellness Valley app to go live.';
  const introBodyPlain = forCoachApproval
    ? `Review the details for ${summary.centerName || 'their center'} below. If approved, share the OTP with ${member}.`
    : 'Review the details below, then enter the OTP in the Wellness Valley app to go live.';
  const instructionsHtml = forCoachApproval
    ? `1. Review the website details above.<br />
                      2. Share the OTP with <strong>${safeMember}</strong> if approved.<br />
                      3. Member enters the OTP in the Wellness Valley app.<br />
                      4. Do not share the OTP if not approved.`
    : `1. Review the website details above.<br />
                      2. Enter this OTP in the Wellness Valley app.<br />
                      3. Your coach website goes live after verification.<br />
                      4. Ignore this email if you did not request publish.`;
  const instructionsText = forCoachApproval
    ? [
      '1. Review the website details above.',
      `2. Share the OTP with ${member} if approved.`,
      '3. Member enters the OTP in the Wellness Valley app.',
      '4. Do not share the OTP if not approved.',
    ]
    : [
      '1. Review the website details above.',
      '2. Enter this OTP in the Wellness Valley app.',
      '3. Your coach website goes live after verification.',
      '4. Ignore this email if you did not request publish.',
    ];

  const text = [
    'Wellness Valley - Coach Website Publish - Verification Required',
    '',
    introTitle.replace(/<[^>]+>/g, ''),
    introBodyPlain,
    coachName && forCoachApproval ? `Coach: ${cleanLine(coachName)}` : null,
    '',
    `Website link: ${summary.publicPath}`,
    '',
    'Website details:',
    `Display name: ${summary.displayName}`,
    `Full name: ${summary.fullName}`,
    summary.title ? `Title: ${summary.title}` : null,
    [summary.city, summary.locality].filter(Boolean).length
      ? `City / Area: ${[summary.city, summary.locality].filter(Boolean).join(', ')}`
      : null,
    summary.centerName ? `Center: ${summary.centerName}` : null,
    summary.businessPhone ? `Phone: ${summary.businessPhone}` : null,
    summary.whatsapp ? `WhatsApp: ${summary.whatsapp}` : null,
    summary.hours ? `Hours: ${summary.hours}` : null,
    summary.offerings.length ? `Offerings: ${summary.offerings.join(', ')}` : null,
    '',
    `Verification OTP: ${spacedOtp(otp)}`,
    `Valid for ${hours} hours`,
    whatsappUrl ? `Share on WhatsApp: ${whatsappUrl}` : null,
    '',
    'Verification instructions:',
    ...instructionsText,
    '',
    'Wellness Valley Team',
    'Automated message. Do not reply.',
    'Support: easy2work.india@gmail.com',
  ].filter((line) => line != null).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;width:100%;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:12px 8px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">

          <tr>
            <td align="center" style="background-color:#059669;padding:16px 20px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.2;">Wellness Valley</p>
              <p style="margin:4px 0 0;color:#d1fae5;font-size:12px;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">Coach Website Publish - Verification Required</p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 8px;color:#111827;font-size:16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                ${escapeHtml(introTitle)}
              </p>
              <p style="margin:0 0 12px;color:#4b5563;font-size:13px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">
                ${introBody}
              </p>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #6ee7b7;border-radius:8px;padding:10px 12px;">
                    <p style="margin:0 0 4px;color:#047857;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:Arial,Helvetica,sans-serif;">Website link</p>
                    <p style="margin:0;color:#111827;font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${safePath}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;">
                <tr>
                  <td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;">
                    <p style="margin:0 0 8px;color:#047857;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:Arial,Helvetica,sans-serif;">Website details</p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      ${detailRowsHtml(summary)}
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px 0;">
                <tr>
                  <td align="center" style="background-color:#f0fdf4;border:2px dashed #6ee7b7;border-radius:8px;padding:14px 12px;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:Arial,Helvetica,sans-serif;">Verification OTP</p>
                    <p style="margin:8px 0 0;color:#047857;font-size:32px;font-weight:700;letter-spacing:6px;font-family:'Courier New',Courier,monospace;line-height:1.1;">${safeOtp}</p>
                    <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Valid for ${hours} hours</p>
                    ${whatsappButtonHtml}
                  </td>
                </tr>
              </table>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;">
                    <p style="margin:0 0 4px;color:#92400e;font-size:12px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">Verification instructions</p>
                    <p style="margin:0;color:#92400e;font-size:12px;line-height:1.45;font-family:Arial,Helvetica,sans-serif;">
                      ${instructionsHtml}
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

  return { subject, text, html, summary, whatsappUrl };
}
