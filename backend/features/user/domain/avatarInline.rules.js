/**
 * Optional same-origin bytes for avatar GET.
 * Default remains 302 (leaderboard <img src>). `inline=1` streams bytes so
 * the cropper can read the photo without R2/Google CORS.
 */
export function wantsInlineAvatar(query = {}) {
  const v = String(query?.inline ?? '').trim().toLowerCase();
  return v === '1' || v === 'true';
}
