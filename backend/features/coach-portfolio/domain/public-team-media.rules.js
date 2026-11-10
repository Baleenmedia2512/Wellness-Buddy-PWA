/**
 * Map coach downline testimonials → public website media sections.
 * What We Say  = verified health videos
 * What We Do   = verified before/after photos
 */

export const PUBLIC_TEAM_MEDIA_LIMITS = Object.freeze({
  whatWeSay: 8,
  whatWeDo: 12,
});

function isVerifiedPhoto(row) {
  return String(row?.status || '') === 'verified';
}

function isVerifiedHealthVideo(row) {
  return String(row?.video_status || row?.videoStatus || '') === 'verified'
    && Boolean(row?.health_video_path || row?.healthVideoPath);
}

function isVideoOnlyPlaceholder(path) {
  return typeof path === 'string' && path.endsWith('_video_only_placeholder.jpg');
}

/**
 * @param {Array<{ user?: object, testimonial?: object|null }>} rows
 * @returns {{ sayCandidates: object[], doCandidates: object[] }}
 */
export function selectPublicTeamMediaCandidates(rows) {
  const sayCandidates = [];
  const doCandidates = [];

  for (const row of rows || []) {
    const user = row?.user || {};
    const t = row?.testimonial || row?.testimonialRaw || null;
    if (!t) continue;

    const userId = Number(user.UserId || user.userId || t.user_id || t.userId) || null;
    const userName = String(user.UserName || user.userName || 'Member').trim() || 'Member';
    const beforePath = t.before_image_path || t.beforeImagePath || null;
    const afterPath = t.after_image_path || t.afterImagePath || null;
    const healthPath = t.health_video_path || t.healthVideoPath || null;

    if (isVerifiedHealthVideo(t) && healthPath) {
      sayCandidates.push({
        userId,
        memberName: userName,
        healthVideoPath: healthPath,
      });
    }

    if (
      isVerifiedPhoto(t)
      && !isVideoOnlyPlaceholder(beforePath)
      && (beforePath || afterPath)
    ) {
      doCandidates.push({
        userId,
        memberName: userName,
        beforeImagePath: beforePath,
        afterImagePath: afterPath,
        beforeWeightKg: t.before_weight_kg ?? t.beforeWeightKg ?? null,
        afterWeightKg: t.after_weight_kg ?? t.afterWeightKg ?? null,
        durationText: t.duration_text || t.durationText || '',
      });
    }
  }

  return {
    sayCandidates: sayCandidates.slice(0, PUBLIC_TEAM_MEDIA_LIMITS.whatWeSay),
    doCandidates: doCandidates.slice(0, PUBLIC_TEAM_MEDIA_LIMITS.whatWeDo),
  };
}

/**
 * @param {{ sayCandidates: object[], doCandidates: object[] }} candidates
 * @param {{
 *   signVideo: (path: string) => Promise<string|null>,
 *   signImage: (path: string) => Promise<string|null>,
 * }} signers
 */
export async function signPublicTeamMedia(candidates, signers) {
  const whatWeSay = [];
  for (const item of candidates.sayCandidates || []) {
    const url = item.healthVideoPath ? await signers.signVideo(item.healthVideoPath) : null;
    if (!url) continue;
    whatWeSay.push({
      userId: item.userId,
      memberName: item.memberName,
      healthVideoUrl: url,
    });
  }

  const whatWeDo = [];
  for (const item of candidates.doCandidates || []) {
    const [beforeImageUrl, afterImageUrl] = await Promise.all([
      item.beforeImagePath ? signers.signImage(item.beforeImagePath) : Promise.resolve(null),
      item.afterImagePath ? signers.signImage(item.afterImagePath) : Promise.resolve(null),
    ]);
    if (!beforeImageUrl && !afterImageUrl) continue;
    whatWeDo.push({
      userId: item.userId,
      memberName: item.memberName,
      beforeImageUrl,
      afterImageUrl,
      beforeWeightKg: item.beforeWeightKg,
      afterWeightKg: item.afterWeightKg,
      durationText: item.durationText || '',
    });
  }

  return { whatWeSay, whatWeDo };
}

export function emptyPublicTeamMedia() {
  return { whatWeSay: [], whatWeDo: [] };
}
