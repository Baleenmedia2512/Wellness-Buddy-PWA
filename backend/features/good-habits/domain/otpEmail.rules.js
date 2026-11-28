/**
 * Coach email for Task by Coach OTP — pure copy + attachment shape.
 */
import {
  buildWhatsAppShareUrl,
  buildWhatsAppShareButtonHtml,
} from '../../../shared/lib/whatsapp-share.rules.js';

/**
 * Prefill WhatsApp text so coach opens the member chat and only taps Send.
 * @param {{ otp: string, memberName?: string|null }} input
 * @returns {string}
 */
export function buildGoodHabitOtpWhatsAppText({ otp, memberName = 'there' } = {}) {
  const member = String(memberName || 'there').replace(/[\r\n]/g, ' ').trim() || 'there';
  const code = String(otp || '').trim();
  return `Hi ${member}, your Wellness Valley Task by Coach verification code is ${code}.`;
}

/**
 * @param {{
 *   otp: string,
 *   memberName?: string|null,
 *   memberPhone?: string|null,
 *   coachName?: string|null,
 *   expiresLabel?: string|null,
 * }} input
 */
export function buildGoodHabitOtpEmail({
  otp,
  memberName = 'Your member',
  memberPhone = null,
  coachName = 'Coach',
  expiresLabel = '11:59:59 PM IST today',
} = {}) {
  const member = String(memberName || 'Your member').replace(/[\r\n]/g, ' ').trim() || 'Your member';
  const coach = String(coachName || 'Coach').replace(/[\r\n]/g, ' ').trim() || 'Coach';
  const code = String(otp || '').trim();
  const until = String(expiresLabel || '11:59:59 PM IST today').replace(/[\r\n]/g, ' ').trim()
    || '11:59:59 PM IST today';

  const waUrl = buildWhatsAppShareUrl({
    phone: memberPhone,
    text: buildGoodHabitOtpWhatsAppText({ otp: code, memberName: member }),
  });
  const whatsappButtonHtml = buildWhatsAppShareButtonHtml({
    shareUrl: waUrl,
    label: `Share code ${code} on WhatsApp`,
  });

  const subject = `Task by Coach OTP for ${member}`;
  const text = [
    `Hi ${coach},`,
    '',
    `${member} wants to log a Task by Coach photo.`,
    '',
    `Your verification code: ${code}`,
    `This code is valid until ${until}.`,
    '',
    'The photo is attached / shown below. If it looks correct, tap Share code on WhatsApp to open their chat with the code ready — then just send.',
    ...(waUrl ? ['', `Share code ${code} on WhatsApp: ${waUrl}`] : []),
    '',
    'After they verify, their score increases. You will get a second email with a Reject link if the task should be removed and the score decreased.',
    '',
    `— Wellness Valley (Ref: #${code})`,
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
      <p style="margin:0 0 12px">Hi ${escapeHtml(coach)},</p>
      <p style="margin:0 0 12px"><strong>${escapeHtml(member)}</strong> wants to log a <strong>Task by Coach</strong> photo.</p>
      <p style="margin:0 0 8px;font-size:13px;color:#475569">Verification code</p>
      <p style="margin:0 0 16px;font-size:28px;font-weight:800;letter-spacing:0.2em;color:#047857">${escapeHtml(code)}</p>
      ${whatsappButtonHtml}
      <p style="margin:12px 0 16px;font-size:12px;color:#94a3b8">Opens WhatsApp with ${escapeHtml(member)}'s chat and the code already typed — just tap Send.</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">Valid until <strong>${escapeHtml(until)}</strong>. If the photo looks correct, share this code with your member.</p>
      <p style="margin:0 0 8px;font-size:13px;font-weight:600">Photo</p>
      <img src="cid:task-by-coach" alt="Task by Coach photo" style="max-width:100%;border-radius:12px;border:1px solid #d1fae5" />
      <p style="margin:16px 0 12px;font-size:12px;color:#64748b">After they verify, their score increases. You will get a second email with a <strong>Reject</strong> link if the task should be removed and the score decreased.</p>
      <p style="margin:0;font-size:12px;color:#94a3b8">— Wellness Valley (Ref: #${escapeHtml(code)})</p>
    </div>
  `.trim();

  return { subject, text, html, whatsappUrl: waUrl };
}

/**
 * @param {string} imageBase64 data URL or raw base64
 * @returns {{ filename: string, content: Buffer, contentType: string, cid: string, contentDisposition: string }|null}
 */
export function buildGoodHabitPhotoAttachment(imageBase64) {
  const raw = String(imageBase64 || '').trim();
  if (!raw) return null;
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
  const contentType = match ? match[1].toLowerCase() : 'image/jpeg';
  const b64 = match ? match[2] : raw.replace(/^data:[^;]+;base64,/, '');
  let content;
  try {
    content = Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
  if (!content.length) return null;
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  return {
    filename: `task-by-coach.${ext}`,
    content,
    contentType,
    cid: 'task-by-coach',
    contentDisposition: 'inline',
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
