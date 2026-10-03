/**
 * Community ID approval email copy — sent to the requester's sponsor.
 * Pure — no I/O.
 */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapHtml(bodyInner) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#111111;line-height:1.5;margin:16px">
${bodyInner}
</body>
</html>`;
}

function cleanName(value, fallback) {
  const who = String(value || fallback).replace(/[\r\n]/g, ' ').trim();
  return who || fallback;
}

/**
 * Create-Community-ID OTP (new code, requester becomes Sponsor).
 * @param {{ otp: string, memberName?: string, communityId?: string, expiresHours?: number }} input
 */
export function buildCreateCommunityIdOtpEmail({
  otp,
  memberName = '',
  communityId = '',
  expiresHours = 24,
} = {}) {
  const code = String(otp || '').trim();
  const who = cleanName(memberName, 'A member');
  const teamCode = cleanName(communityId, 'a Community ID');
  const subject = `${who} - Community ID approval`;
  const text = [
    'Wellness Valley',
    '',
    `${who} wants to create Community ID ${teamCode}.`,
    `Share this approval code with them. It expires in ${expiresHours} hours.`,
    `Approval code: ${code}`,
    '',
    'If you were not expecting this, you can ignore this message.',
  ].join('\n');
  const html = wrapHtml(
    `<p>Wellness Valley</p>`
    + `<p>${escapeHtml(who)} wants to create Community ID <strong>${escapeHtml(teamCode)}</strong>.</p>`
    + `<p>Share this approval code with them. It expires in ${expiresHours} hours.</p>`
    + `<p>Approval code: <strong>${escapeHtml(code)}</strong></p>`
    + `<p>If you were not expecting this, you can ignore this message.</p>`,
  );
  return { subject, text, html };
}

/**
 * Co-sponsor join OTP — names the main sponsor of the existing Community ID.
 * @param {{ otp: string, memberName?: string, communityId?: string, mainSponsorName?: string, expiresHours?: number }} input
 */
export function buildCoSponsorCommunityIdOtpEmail({
  otp,
  memberName = '',
  communityId = '',
  mainSponsorName = '',
  expiresHours = 24,
} = {}) {
  const code = String(otp || '').trim();
  const who = cleanName(memberName, 'A member');
  const teamCode = cleanName(communityId, 'a Community ID');
  const sponsor = cleanName(mainSponsorName, 'the main sponsor');
  const subject = `${who} - Co-Sponsor request`;
  const text = [
    'Wellness Valley',
    '',
    `${who} is requesting to become co-sponsor with ${sponsor} for Community ID ${teamCode}.`,
    `Share this approval code with them. It expires in ${expiresHours} hours.`,
    `Approval code: ${code}`,
    '',
    'If you were not expecting this, you can ignore this message.',
  ].join('\n');
  const html = wrapHtml(
    `<p>Wellness Valley</p>`
    + `<p>${escapeHtml(who)} is requesting to become co-sponsor with <strong>${escapeHtml(sponsor)}</strong>`
    + ` for Community ID <strong>${escapeHtml(teamCode)}</strong>.</p>`
    + `<p>Share this approval code with them. It expires in ${expiresHours} hours.</p>`
    + `<p>Approval code: <strong>${escapeHtml(code)}</strong></p>`
    + `<p>If you were not expecting this, you can ignore this message.</p>`,
  );
  return { subject, text, html };
}
