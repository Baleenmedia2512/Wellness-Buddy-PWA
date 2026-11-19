/**
 * When a Transformation card is complete enough to require sponsor OTP.
 *
 * Photo approval requires a real Before file and a different real After file.
 * A missing After, a video-only placeholder, or the same path in both columns
 * is not an After photo and must not start coach OTP.
 */

const VIDEO_ONLY_SUFFIX = '_video_only_placeholder.jpg';

export function isPlaceholderImagePath(path) {
  return typeof path !== 'string' || !path || path.endsWith(VIDEO_ONLY_SUFFIX);
}

export function hasRealBeforePhoto(row = {}) {
  const path = row.before_image_path ?? row.beforeImagePath;
  return !isPlaceholderImagePath(path);
}

export function hasVisibleAfterCard(row = {}) {
  const path = row.after_image_path ?? row.afterImagePath;
  return !isPlaceholderImagePath(path);
}

export function hasDistinctAfterPhoto(row = {}) {
  const before = row.before_image_path ?? row.beforeImagePath;
  const after = row.after_image_path ?? row.afterImagePath;
  if (isPlaceholderImagePath(after)) return false;
  return after !== before;
}

export function afterWeightDiffersFromBefore(beforeWeightKg, afterWeightKg) {
  const before = Number(beforeWeightKg);
  const after = Number(afterWeightKg);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
  return before !== after;
}

/**
 * True when before+after can be sponsor-verified.
 * @param {object} row DB row or overlay with snake_case paths
 * @param {object} [overlay] pending submit values
 */
export function isPhotoPairComplete(row = {}, overlay = {}) {
  const beforePath = overlay.beforePath ?? row.before_image_path ?? row.beforeImagePath;
  const afterPath = overlay.afterPath ?? row.after_image_path ?? row.afterImagePath;
  const status = overlay.status ?? row.status;
  const beforeWeightKg = overlay.beforeWeightKg ?? row.before_weight_kg ?? row.beforeWeightKg;
  const afterWeightKg = overlay.afterWeightKg ?? row.after_weight_kg ?? row.afterWeightKg;

  if (isPlaceholderImagePath(beforePath)) return false;

  const pair = { before_image_path: beforePath, after_image_path: afterPath };
  if (hasDistinctAfterPhoto(pair)) return true;
  if (!hasVisibleAfterCard(pair)) return false;
  if (status === 'pending' || status === 'verified') return true;
  return afterWeightDiffersFromBefore(beforeWeightKg, afterWeightKg);
}

export function hasCompletePhotoTestimonial(row = {}) {
  return isPhotoPairComplete(row);
}

/**
 * Coach photo approval requires two different Transformation files:
 * a real Before and a real After. Profile display, a Before-only save,
 * and a copied Before path do not qualify.
 *
 * @param {object} row
 * @param {object} [overlay]
 * @returns {boolean}
 */
export function shouldSendPhotoApprovalOtp(row = {}, overlay = {}) {
  const beforePath = overlay.beforePath ?? row.before_image_path ?? row.beforeImagePath;
  const afterPath = overlay.afterPath ?? row.after_image_path ?? row.afterImagePath;
  return hasRealBeforePhoto({ before_image_path: beforePath })
    && hasDistinctAfterPhoto({
      before_image_path: beforePath,
      after_image_path: afterPath,
    });
}

/**
 * Video-only stubs (and missing rows) have no real Before/After in the DB even
 * when the Mine card is showing Profile-seeded photos. Submit must hydrate
 * those photos before deciding OTP — otherwise approval is silently skipped.
 */
export function shouldHydratePhotosFromProfile(row = null) {
  if (!row) return true;
  return !hasRealBeforePhoto(row);
}

/**
 * Health-issue edits attach OTP to the member's latest photo or video entry.
 * A visible before+after card (including a seeded clone) uses the photo channel.
 */
export function resolveHealthIssueOtpChannel(row = {}) {
  const hasPhoto = isPhotoPairComplete(row)
    || hasRealBeforePhoto(row);
  const hasVideo = !!(row.health_video_path || row.business_video_path
    || row.healthVideoPath || row.businessVideoPath);
  if (!hasPhoto && !hasVideo) return null;
  if (hasPhoto && !hasVideo) return 'photo';
  if (!hasPhoto && hasVideo) return 'video';

  const photoTs = Math.max(
    parseStoragePathTimestamp(row.before_image_path ?? row.beforeImagePath),
    parseStoragePathTimestamp(row.after_image_path ?? row.afterImagePath),
  );
  const videoTs = Math.max(
    Date.parse(row.video_verified_at || row.videoVerifiedAt || '') || 0,
    Date.parse(row.updated_at || row.updatedAt || '') || 0,
  );
  return photoTs >= videoTs ? 'photo' : 'video';
}

function parseStoragePathTimestamp(path) {
  if (!path || typeof path !== 'string') return 0;
  const match = path.match(/_(\d{10,13})\./);
  return match ? Number(match[1]) : 0;
}
