/**
 * Coach email for Task by Coach OTP — pure copy + attachment shape.
 */

/**
 * @param {{
 *   otp: string,
 *   memberName?: string|null,
 *   coachName?: string|null,
 *   expiresMinutes?: number,
 * }} input
 */
export function buildGoodHabitOtpEmail({
  otp,
  memberName = 'Your member',
  coachName = 'Coach',
  expiresMinutes = 20,
} = {}) {
  const member = String(memberName || 'Your member').replace(/[\r\n]/g, ' ').trim() || 'Your member';
  const coach = String(coachName || 'Coach').replace(/[\r\n]/g, ' ').trim() || 'Coach';
  const code = String(otp || '').trim();

  const subject = `Task by Coach OTP for ${member}`;
  const text = [
    `Hi ${coach},`,
    '',
    `${member} wants to log a Task by Coach photo.`,
    '',
    `Your verification code: ${code}`,
    `This code expires in ${expiresMinutes} minutes.`,
    '',
    'The photo is attached / shown below. If it looks correct, tell your member this code so they can save the log.',
    '',
    '— Wellness Valley',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
      <p style="margin:0 0 12px">Hi ${escapeHtml(coach)},</p>
      <p style="margin:0 0 12px"><strong>${escapeHtml(member)}</strong> wants to log a <strong>Task by Coach</strong> photo.</p>
      <p style="margin:0 0 8px;font-size:13px;color:#475569">Verification code</p>
      <p style="margin:0 0 16px;font-size:28px;font-weight:800;letter-spacing:0.2em;color:#047857">${escapeHtml(code)}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#64748b">Expires in ${expiresMinutes} minutes. Tell your member this code if the photo looks correct.</p>
      <p style="margin:0 0 8px;font-size:13px;font-weight:600">Photo</p>
      <img src="cid:task-by-coach" alt="Task by Coach photo" style="max-width:100%;border-radius:12px;border:1px solid #d1fae5" />
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">— Wellness Valley</p>
    </div>
  `.trim();

  return { subject, text, html };
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
