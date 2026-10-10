/**
 * Coach verification email for member testimonials.
 *
 * Encoding note: never use emoji or non-ASCII punctuation in email HTML/subject.
 * UTF-8 multi-byte chars (emoji, en-dash) render as mojibake (e.g. ðŸŒ¿, â€")
 * when clients or SMTP treat the message as Latin-1/Windows-1252.
 * Use ASCII-only copy and explicit charset in nodemailer sendMail().
 */

import {
  isTransformationWeightLoss,
  transformationWeightVerb,
} from './domain/transformationWeightDirection.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Email-safe photo. Set a width hint only — never a locked height.
 * Gmail (and similar clients) honour max-width:100% / width:100% by changing
 * the rendered width while keeping a declared height, which stretches
 * portrait photos in narrow columns and squashes them in full-width rows.
 */
function buildPhotoImg(src, alt, maxWidthPx, extraStyle = '') {
  const safeSrc = escapeHtml(src);
  const safeAlt = escapeHtml(alt);
  return `<img src="${safeSrc}" alt="${safeAlt}" width="${maxWidthPx}" class="photo-img" style="display:block;width:100%;max-width:${maxWidthPx}px;height:auto;margin:0 auto;border:0;border-radius:6px;${extraStyle}" />`;
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

function buildProgressSentence(memberName, _goalType, beforeWeight, afterWeight, durationText) {
  const weightStr = formatWeight(weightChangeKg(beforeWeight, afterWeight));
  const verb = transformationWeightVerb(beforeWeight, afterWeight, { capitalize: false }) || 'changed';
  return `${escapeHtml(memberName)} has ${verb} ${weightStr} kg in ${escapeHtml(durationText)}.`;
}

function buildProgressSentencePlain(memberName, _goalType, beforeWeight, afterWeight, durationText) {
  const n = weightChangeKg(beforeWeight, afterWeight);
  const weightStr = n % 1 === 0 ? String(n) : n.toFixed(1);
  const verb = transformationWeightVerb(beforeWeight, afterWeight, { capitalize: false }) || 'changed';
  return `${memberName} has ${verb} ${weightStr} kg in ${durationText}.`;
}

/** Progress sentence as a rounded pill (matches recovered-issue chips). */
function buildProgressPill(memberName, goalType, beforeWeight, afterWeight, durationText) {
  const text = buildProgressSentence(memberName, goalType, beforeWeight, afterWeight, durationText);
  const isLoss = isTransformationWeightLoss(beforeWeight, afterWeight) !== false;
  const bg = isLoss ? '#ecfdf5' : '#eff6ff';
  const border = isLoss ? '#a7f3d0' : '#bfdbfe';
  const color = isLoss ? '#047857' : '#1d4ed8';
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;">
      <tr>
        <td>
          <span style="display:inline-block;padding:6px 14px;background-color:${bg};border:1px solid ${border};border-radius:9999px;color:${color};font-size:13px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.35;">${text}</span>
        </td>
      </tr>
    </table>`;
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

function buildStatsRow(beforeWeight, afterWeight, goalLabel, durationText) {
  const durationSafe = String(durationText ?? '').trim();
  const showDuration = Boolean(durationSafe && durationSafe !== '—');
  const width = showDuration ? '25%' : '33%';
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;">
      <tr>
        ${buildMetricCard('Before', `${formatWeight(beforeWeight)} kg`, width)}
        ${buildMetricCard('After', `${formatWeight(afterWeight)} kg`, width)}
        ${buildMetricCard('Goal', escapeHtml(goalLabel), width)}
        ${showDuration ? buildMetricCard('Duration', escapeHtml(durationSafe), width) : ''}
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

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px 0;">
      <tr>
        <td width="50%" valign="top" align="center" class="photo-col" style="padding:0 4px 0 0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:6px;">
                <p style="margin:0 0 6px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">Before</p>
                ${buildPhotoImg(beforeUrl, 'Before', 260)}
              </td>
            </tr>
          </table>
        </td>
        <td width="50%" valign="top" align="center" class="photo-col" style="padding:0 0 0 4px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:6px;">
                <p style="margin:0 0 6px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">After</p>
                ${buildPhotoImg(afterUrl, 'After', 260)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Full Transformation share card (same image members share in-app).
 * Prefer cid: inline attachment so Gmail does not strip remote signed URLs.
 * @param {string} shareCardSrc
 * @param {string|null} [previewHref]
 */
export function buildShareCardRow(shareCardSrc, previewHref = null) {
  if (!shareCardSrc) return '';
  const img = buildPhotoImg(shareCardSrc, 'Transformation card', 280);
  const linked = (previewHref && /^https?:\/\//i.test(String(previewHref)))
    ? `<a href="${escapeHtml(previewHref)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">${img}</a>`
    : img;
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;">
      <tr>
        <td align="center" style="padding:0;">
          <p style="margin:0 0 8px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">Transformation Card</p>
          ${linked}
          <p style="margin:6px 0 0;color:#9ca3af;font-size:9px;font-family:Arial,Helvetica,sans-serif;">Tap card to open preview</p>
        </td>
      </tr>
    </table>`;
}

/**
 * One compact Previous/New cell: real Before | After photos (never a share-card
 * JPEG — those can bake nested UI into the After slot in Gmail).
 * Tap opens the full Transformation Card preview when previewHref is set.
 */
function buildCompactTransformationPreview({
  label,
  beforeUrl,
  afterUrl,
  beforeWeight,
  afterWeight,
  cardImageUrl = null,
  previewHref = null,
  tone = 'new',
}) {
  const hasPair = Boolean(beforeUrl && afterUrl);
  const faceUrl = hasPair ? null : (cardImageUrl || afterUrl);
  if (!hasPair && !faceUrl) return '';
  const isPrev = tone === 'previous';
  const border = isPrev ? '#fecdd3' : '#bbf7d0';
  const bg = isPrev ? '#fff1f2' : '#f0fdf4';
  const titleColor = isPrev ? '#9f1239' : '#047857';
  const beforeKg = formatWeight(beforeWeight);
  const afterKg = formatWeight(afterWeight);
  const safeLabel = escapeHtml(label);

  const photosBlock = hasPair
    ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td width="50%" valign="top" style="padding:0 2px 0 0;">
            ${buildPhotoImg(beforeUrl, `${label} Before`, 120)}
            <p style="margin:4px 0 0;color:#9ca3af;font-size:9px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Before</p>
          </td>
          <td width="50%" valign="top" style="padding:0 0 0 2px;">
            ${buildPhotoImg(afterUrl, `${label} After`, 120)}
            <p style="margin:4px 0 0;color:#9ca3af;font-size:9px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">After</p>
          </td>
        </tr>
      </table>`
    : buildPhotoImg(faceUrl, `${label} Transformation Card`, 140);

  const body = `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:${bg};border:1px solid ${border};border-radius:8px;overflow:hidden;">
      <tr>
        <td align="center" style="padding:6px 6px 4px 6px;">
          <p style="margin:0;color:${titleColor};font-size:10px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${safeLabel}</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 8px 4px 8px;">
          ${photosBlock}
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 6px 4px 6px;">
          <p style="margin:0;color:#6b7280;font-size:10px;font-weight:600;font-family:Arial,Helvetica,sans-serif;line-height:1.35;">
            ${beforeKg} kg &#8594; ${afterKg} kg
          </p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 6px 8px 6px;">
          <p style="margin:0;color:#9ca3af;font-size:9px;font-family:Arial,Helvetica,sans-serif;">Tap for full Transformation Card</p>
        </td>
      </tr>
    </table>`;

  if (previewHref && /^https?:\/\//i.test(String(previewHref))) {
    return `
      <a href="${escapeHtml(previewHref)}" target="_blank" rel="noopener noreferrer"
         style="display:block;text-decoration:none;color:inherit;">
        ${body}
      </a>`;
  }
  return body;
}

/**
 * Previous + New side by side — each shows Before | After photos.
 * Tap opens the full Transformation Card preview.
 */
export function buildTransformationCardCompareRow({
  previousBeforeUrl,
  previousAfterUrl,
  previousBeforeWeight,
  previousAfterWeight,
  previousCardImageUrl = null,
  previousPreviewHref = null,
  beforeUrl,
  afterUrl,
  beforeWeight,
  afterWeight,
  currentCardImageUrl = null,
  currentPreviewHref = null,
}) {
  // Prefer real Before|After photo pairs (clear in Gmail). Share-card JPEG is fallback only.
  const hasPrevious = Boolean((previousBeforeUrl && previousAfterUrl) || previousCardImageUrl);
  const hasCurrent = Boolean((beforeUrl && afterUrl) || currentCardImageUrl);
  if (!hasPrevious || !hasCurrent) return '';

  const previousCell = buildCompactTransformationPreview({
    label: 'Previous',
    beforeUrl: previousBeforeUrl,
    afterUrl: previousAfterUrl,
    beforeWeight: previousBeforeWeight,
    afterWeight: previousAfterWeight,
    // Only use share-card image when the photo pair is missing.
    cardImageUrl: (previousBeforeUrl && previousAfterUrl) ? null : previousCardImageUrl,
    previewHref: previousPreviewHref,
    tone: 'previous',
  });
  const newCell = buildCompactTransformationPreview({
    label: 'New',
    beforeUrl,
    afterUrl,
    beforeWeight,
    afterWeight,
    cardImageUrl: (beforeUrl && afterUrl) ? null : currentCardImageUrl,
    previewHref: currentPreviewHref,
    tone: 'new',
  });

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;">
      <tr>
        <td align="center" style="padding:0 0 8px 0;">
          <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">Before vs After</p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;font-family:Arial,Helvetica,sans-serif;">Previous and New — tap for the full Transformation Card preview</p>
        </td>
      </tr>
      <tr>
        <td>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="46%" valign="top" class="photo-col" style="padding:0 2px 0 0;">
                ${previousCell}
              </td>
              <td width="8%" valign="middle" align="center" style="padding:0 2px;color:#059669;font-size:18px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">&#8594;</td>
              <td width="46%" valign="top" class="photo-col" style="padding:0 0 0 2px;">
                ${newCell}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Email Transformation card built from the real Before/After storage photos.
 * Left = beforeUrl, right = afterUrl (same pair as in-app). Prefer cid: URLs.
 * @param {string} [heading] - e.g. "Previous Transformation Card" / "Current Transformation Card"
 */
export function buildTransformationCardEmailBlock({
  memberName,
  beforeUrl,
  afterUrl,
  beforeWeight,
  afterWeight,
  goalType,
  durationText,
  recoveredHealthIssues,
  heading = 'Transformation Card',
}) {
  if (!beforeUrl || !afterUrl) return '';

  const safeMember = escapeHtml(memberName || 'Member');
  const safeHeading = escapeHtml(heading);
  const beforeKg = formatWeight(beforeWeight);
  const afterKg = formatWeight(afterWeight);
  const durationSafe = String(durationText ?? '').trim();
  const bw = Number(beforeWeight);
  const aw = Number(afterWeight);
  const verb = transformationWeightVerb(bw, aw);
  const canProgress = Boolean(verb) && durationSafe && durationSafe !== '—';
  const diffKg = canProgress ? formatWeight(Math.abs(aw - bw)) : '';
  const progressText = canProgress
    ? `${verb} ${diffKg} kgs${durationSafe ? ` in ${escapeHtml(durationSafe)}` : ''}`
    : '';
  const issues = Array.isArray(recoveredHealthIssues)
    ? recoveredHealthIssues.map((i) => String(i ?? '').trim()).filter(Boolean).slice(0, 10)
    : [];
  const issuePills = issues.map((issue) => (
    `<span style="display:inline-block;margin:3px 3px 0 0;padding:5px 10px;background-color:#ffffff;border:1px solid #f9a8d4;border-radius:9999px;color:#9f1239;font-size:12px;font-weight:600;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">${escapeHtml(issue)}</span>`
  )).join('');

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;">
      <tr>
        <td align="center" style="padding:0 0 8px 0;">
          <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">${safeHeading}</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="340" style="width:340px;max-width:100%;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr>
              <td align="center" style="background-color:#059669;padding:12px 14px;">
                <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;line-height:1.2;">Wellness Valley</p>
                <p style="margin:3px 0 0;color:#a7f3d0;font-size:11px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">Transformation Results</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:12px 12px 8px 12px;">
                <p style="margin:0;color:#111827;font-size:18px;font-weight:800;font-family:Arial,Helvetica,sans-serif;line-height:1.25;letter-spacing:0.3px;">${safeMember}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 10px 8px 10px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td width="50%" valign="top" align="center" class="photo-col" style="padding:0 3px 0 0;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="background-color:#f3f4f6;border-radius:10px;padding:4px;">
                            ${buildPhotoImg(beforeUrl, 'Before', 150)}
                            <p style="margin:6px 0 0;color:#e11d72;font-size:14px;font-weight:700;font-family:Georgia,'Times New Roman',serif;font-style:italic;line-height:1.2;">Before</p>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:6px 0 0 0;">
                            <p style="margin:0;color:#9ca3af;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">BEFORE</p>
                            <p style="margin:2px 0 0;color:#111827;font-size:14px;font-weight:800;font-family:Arial,Helvetica,sans-serif;">${beforeKg} kg</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="50%" valign="top" align="center" class="photo-col" style="padding:0 0 0 3px;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="background-color:#f3f4f6;border-radius:10px;padding:4px;">
                            ${buildPhotoImg(afterUrl, 'After', 150)}
                            <p style="margin:6px 0 0;color:#16a34a;font-size:14px;font-weight:700;font-family:Georgia,'Times New Roman',serif;font-style:italic;line-height:1.2;">After</p>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:6px 0 0 0;">
                            <p style="margin:0;color:#9ca3af;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">AFTER</p>
                            <p style="margin:2px 0 0;color:#111827;font-size:14px;font-weight:800;font-family:Arial,Helvetica,sans-serif;">${afterKg} kg</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${progressText ? `
            <tr>
              <td align="center" style="padding:0 12px 10px 12px;text-align:center;">
                <span style="display:inline-block;margin:0 auto;padding:6px 14px;background-color:#dbeafe;border-radius:9999px;color:#2563eb;font-size:12px;font-weight:800;font-family:Arial,Helvetica,sans-serif;line-height:1.3;text-align:center;">${progressText}</span>
              </td>
            </tr>` : ''}
            ${issues.length ? `
            <tr>
              <td style="padding:0 12px 12px 12px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="background-color:#fff1f2;border:1px solid #f9a8d4;border-radius:10px;padding:8px 10px;">
                      <p style="margin:0;color:#be185d;font-size:14px;font-weight:700;font-family:Georgia,'Times New Roman',serif;font-style:italic;text-align:center;">Health Issues</p>
                      <p style="margin:2px 0 6px;color:#9ca3af;font-size:9px;font-style:italic;font-family:Arial,Helvetica,sans-serif;text-align:center;">while joining in the community</p>
                      <p style="margin:0;text-align:center;line-height:1.5;">${issuePills}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>` : ''}
            <tr>
              <td align="center" style="padding:0 12px 12px 12px;">
                <p style="margin:0;padding:8px 10px;background-color:#fde047;border-radius:6px;color:#111827;font-size:9px;font-weight:600;font-family:Arial,Helvetica,sans-serif;line-height:1.35;">
                  The views expressed are that of individuals. These products are not intended to diagnose, treat or cure any disease.
                </p>
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
  shareCardSrc = null,
}) {
  const safeMember = escapeHtml(memberName);
  const safeOtp = formatOtpDisplay(otp);
  const goalLabel = goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';
  // Prefer HTML card from real Before/After URLs (left/right) — never a stale client bitmap.
  const transformationCard = buildTransformationCardEmailBlock({
    memberName,
    beforeUrl,
    afterUrl,
    beforeWeight,
    afterWeight,
    goalType,
    durationText,
    recoveredHealthIssues,
  });
  const hasCard = Boolean(transformationCard);
  const detailsBlock = hasCard
    ? transformationCard
    : `${shareCardSrc ? buildShareCardRow(shareCardSrc) : ''}
              ${buildStatsRow(beforeWeight, afterWeight, goalLabel, durationText)}
              ${buildPhotosRow(beforeUrl, afterUrl)}
              ${buildHealthIssuesRow(recoveredHealthIssues)}
              ${buildProgressPill(memberName, goalType, beforeWeight, afterWeight, durationText)}`;
  const reviewStep = hasCard
    ? '1. Review the Transformation card (Before on the left, After on the right).<br />'
    : '1. Review the before and after photos and recovered health issues.<br />';

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
      .photo-img { width: 100% !important; height: auto !important; }
      .header-pad { padding: 14px 12px !important; }
      .footer-pad { padding: 12px !important; }
    }
    @media only screen and (max-width: 360px) {
      .photo-col { display: block !important; width: 100% !important; padding: 0 0 8px 0 !important; }
      .photo-img { height: auto !important; }
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
              <p style="margin:0 0 12px;color:#4b5563;font-size:13px;line-height:1.4;font-family:Arial,Helvetica,sans-serif;">
                Review the details below and share the OTP with <strong style="color:#111827;">${safeMember}</strong> to verify.
              </p>

              ${detailsBlock}

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
                      ${reviewStep}
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
  duration: 'Duration (days / months)',
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
function buildSinglePhotoCell(url, label) {
  if (!url) return '';
  return `
    <td width="50%" valign="top" align="center" class="photo-col" style="padding:0 3px 0 3px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:6px;">
            <p style="margin:0 0 6px;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</p>
            ${buildPhotoImg(url, label, 260)}
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

  // First upload — no previous photo to compare against, just show the new photo.
  if (isFirstUpload) {
    return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px 0;">
      <tr>
        <td>
          <p style="margin:0 0 6px;color:#374151;font-size:11px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(slotLabel)}</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px;">
          <p style="margin:0 0 6px;color:#047857;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:Arial,Helvetica,sans-serif;">New Upload</p>
          ${buildPhotoImg(newUrl, slotLabel, 280)}
        </td>
      </tr>
    </table>`;
  }

  // Edit — show previous → new comparison only when a previous photo exists.
  const prevCell = previousUrl
    ? `
      <td width="44%" valign="top" align="center" style="padding:0 0 0 0;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:4px;">
              <p style="margin:0 0 4px;color:#9ca3af;font-size:9px;font-weight:700;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">PREVIOUS</p>
              ${buildPhotoImg(previousUrl, `Previous ${slotLabel}`, 200, 'opacity:0.6;')}
            </td>
          </tr>
        </table>
      </td>`
    : '';

  const arrowCell = prevCell
    ? `<td width="12%" valign="middle" align="center" style="padding:0 2px;font-size:18px;color:#059669;font-family:Arial,Helvetica,sans-serif;font-weight:700;">&#8594;</td>`
    : '';

  const newCellWidth = prevCell ? '44%' : '100%';
  const newCell = `
    <td width="${newCellWidth}" valign="top" align="center" style="padding:0 0 0 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:4px;">
            <p style="margin:0 0 4px;color:#047857;font-size:9px;font-weight:700;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">NEW</p>
            ${buildPhotoImg(newUrl, `New ${slotLabel}`, 200)}
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
  previousBeforeWeight = null,
  previousAfterWeight = null,
  previousGoalType = null,
  previousDurationText = null,
  previousRecoveredHealthIssues = null,
  previousPreviewHref = null,
  currentPreviewHref = null,
  previousCardImageUrl = null,
  currentCardImageUrl = null,
  healthVideoUrl,
  businessVideoUrl,
  recoveredHealthIssues,
  isComplete,
  shareCardSrc = null,
}) {
  const safeMember = escapeHtml(memberName);
  const safeOtp    = formatOtpDisplay(otp);
  const slots      = new Set(changedSlots || []);

  const goalLabel  = (goalType === 'loss') ? 'Weight Loss' : 'Weight Gain';
  const durationSafe = String(durationText ?? '').trim();
  const canShowProgress = Boolean(
    isComplete
    && Number.isFinite(Number(beforeWeight))
    && Number.isFinite(Number(afterWeight))
    && durationSafe
    && durationSafe !== '—',
  );

  const changedBlock = buildChangedSlotsBlock(changedSlots);

  // Side-by-side small Previous | New cards (card image only) — tap opens full preview.
  const compareCards = (
    (previousCardImageUrl || (previousBeforeUrl && previousAfterUrl))
    && (currentCardImageUrl || (beforeUrl && afterUrl))
  )
    ? buildTransformationCardCompareRow({
      previousBeforeUrl,
      previousAfterUrl,
      previousBeforeWeight: previousBeforeWeight ?? beforeWeight,
      previousAfterWeight: previousAfterWeight ?? afterWeight,
      previousCardImageUrl,
      previousPreviewHref,
      beforeUrl,
      afterUrl,
      beforeWeight,
      afterWeight,
      currentCardImageUrl,
      currentPreviewHref,
    })
    : '';

  // New-only share card when Previous is missing — must still show (was a blank email bug).
  const singleShareCard = (!compareCards && currentCardImageUrl)
    ? buildShareCardRow(currentCardImageUrl, currentPreviewHref)
    : '';

  // HTML Before|After card when there is no share-card image at all.
  const currentCard = (!compareCards && !singleShareCard && isComplete && beforeUrl && afterUrl)
    ? buildTransformationCardEmailBlock({
      memberName,
      beforeUrl,
      afterUrl,
      beforeWeight,
      afterWeight,
      goalType,
      durationText,
      recoveredHealthIssues,
      heading: 'Transformation Card',
    })
    : '';

  const hasCard = Boolean(compareCards || singleShareCard || currentCard);

  // Do not show single-photo PREVIOUS → NEW strips when Transformation Cards are present.
  const beforeDiff = '';
  const afterDiff = '';
  const previousCard = '';

  const progressHtml = (!hasCard && canShowProgress)
    ? buildProgressPill(memberName, goalType, beforeWeight, afterWeight, durationSafe)
    : '';

  const currentPhotosBlock = (!hasCard && isComplete && beforeUrl && afterUrl)
    ? buildPhotosRow(beforeUrl, afterUrl)
    : '';

  const healthVideoBlock   = slots.has('health')   ? buildVideoUpdatedRow('Health Results Video — Updated',   healthVideoUrl,   '#059669') : '';
  const businessVideoBlock = slots.has('business') ? buildVideoUpdatedRow('Business Results Video — Updated', businessVideoUrl, '#2563eb') : '';

  const statsBlock = (!hasCard && isComplete && beforeWeight && afterWeight)
    ? buildStatsRow(beforeWeight, afterWeight, goalLabel, durationText)
    : '';

  const shareCardBlock = (!hasCard && shareCardSrc) ? buildShareCardRow(shareCardSrc) : '';
  const issuesBlock = hasCard ? '' : buildHealthIssuesRow(recoveredHealthIssues);

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
      .photo-img { width: 100% !important; height: auto !important; }
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
              ${beforeDiff}
              ${afterDiff}
              ${compareCards}
              ${singleShareCard}
              ${previousCard}
              ${currentCard}
              ${shareCardBlock}
              ${statsBlock}
              ${currentPhotosBlock}
              ${healthVideoBlock}
              ${businessVideoBlock}
              ${issuesBlock}
              ${progressHtml}

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
  const durationSafe = String(durationText ?? '').trim();
  const canShowProgress = Boolean(
    isComplete
    && Number.isFinite(Number(beforeWeight))
    && Number.isFinite(Number(afterWeight))
    && durationSafe
    && durationSafe !== '—',
  );

  const lines = [
    'Wellness Valley - Member Testimonial Updates',
    '',
    `${memberName} has submitted updates for approval.`,
  ];

  if (canShowProgress) {
    lines.push(buildProgressSentencePlain(memberName, goalType, beforeWeight, afterWeight, durationSafe));
  }

  lines.push(
    '',
    'WHAT CHANGED:',
    ...(changedSlots || []).map((s) => `  - ${SLOT_LABELS[s] || s}`),
    '',
  );

  if (isComplete && beforeWeight && afterWeight) {
    lines.push(`Before: ${formatWeight(beforeWeight)} kg | After: ${formatWeight(afterWeight)} kg | Goal: ${goalLabel}`);
    if (durationSafe && durationSafe !== '—') lines.push(`Duration: ${durationSafe}`);
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
