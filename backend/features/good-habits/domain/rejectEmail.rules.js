/**
 * Coach email when member logs Task by Coach (score applied) — photo + Reject link.
 * No OTP — coach only needs Reject if the task is incomplete.
 */

/**
 * @param {{
 *   memberName?: string|null,
 *   coachName?: string|null,
 *   rejectUrl: string,
 * }} input
 */
export function buildGoodHabitRejectEmail({
  memberName = 'Your member',
  coachName = 'Coach',
  rejectUrl,
} = {}) {
  const member = String(memberName || 'Your member').replace(/[\r\n]/g, ' ').trim() || 'Your member';
  const coach = String(coachName || 'Coach').replace(/[\r\n]/g, ' ').trim() || 'Coach';
  const url = String(rejectUrl || '').trim();

  const subject = `Task by Coach — ${member}`;
  const text = [
    `Hi ${coach},`,
    '',
    `${member} logged a Task by Coach photo. Their wellness score for today already includes this task.`,
    '',
    'If the photo is incomplete, reject it here to remove the task and decrease their score:',
    url || '(reject link unavailable)',
    '',
    '— Wellness Valley',
  ].join('\n');

  const rejectButton = url
    ? `<p style="margin:20px 0">
        <a href="${escapeHtml(url)}"
           style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px">
          Reject
        </a>
      </p>`
    : '';

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
      <p style="margin:0 0 12px">Hi ${escapeHtml(coach)},</p>
      <p style="margin:0 0 12px"><strong>${escapeHtml(member)}</strong> logged a <strong>Task by Coach</strong> photo. Their wellness score for today already includes this task.</p>
      <p style="margin:0 0 8px;font-size:13px;font-weight:600">Photo</p>
      <img src="cid:task-by-coach" alt="Task by Coach photo" style="max-width:100%;border-radius:12px;border:1px solid #d1fae5" />
      ${rejectButton}
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">— Wellness Valley</p>
    </div>
  `.trim();

  return { subject, text, html };
}

/**
 * Public origin for coach email links.
 * Prefer PUBLIC_API_BASE_URL (same host the app calls). Local default → localhost.
 * @param {string} [explicit]
 * @returns {string}
 */
export function resolveRejectLinkBaseUrl(explicit) {
  const raw = String(
    explicit
      || process.env.PUBLIC_API_BASE_URL
      || process.env.PUBLIC_SITE_BASE_URL
      || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : 'https://wellnessvalley.in'),
  ).trim().replace(/\/+$/, '');
  return raw;
}

/**
 * Absolute reject API URL for the coach email (one-click; soft-delete + score drop).
 * @param {string} token
 * @param {string} [baseUrl]
 */
export function buildGoodHabitRejectUrl(token, baseUrl) {
  const t = String(token || '').trim();
  if (!t) return '';
  const base = resolveRejectLinkBaseUrl(baseUrl);
  return `${base}/api/good-habits/reject?token=${encodeURIComponent(t)}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
