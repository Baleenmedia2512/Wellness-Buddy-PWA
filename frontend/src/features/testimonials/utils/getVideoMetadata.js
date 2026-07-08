/**
 * Client-side video metadata helpers for testimonial result-video uploads.
 * Uses a hidden <video> element; falls back when WebView cannot decode metadata.
 */

const METADATA_TIMEOUT_MS = 15000;

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/3gpp',
  'video/mpeg',
]);

const ALLOWED_VIDEO_EXTENSION = /\.(mp4|mov|3gp|m4v)$/i;

/**
 * @param {File} file
 * @returns {boolean}
 */
export function isAllowedVideoFile(file) {
  if (ALLOWED_VIDEO_TYPES.has(file.type)) return true;
  if (ALLOWED_VIDEO_EXTENSION.test(file.name)) {
    // Some mobile pickers report empty or generic MIME types.
    return !file.type || file.type === 'application/octet-stream';
  }
  return false;
}

/**
 * @param {HTMLVideoElement} video
 * @returns {string|null}
 */
function formatMediaError(video) {
  switch (video.error?.code) {
    case 3:
      return 'This video uses a codec your device cannot preview. Save it as MP4 (H.264) and try again.';
    case 4:
      return 'This video format is not supported. Please use MP4, MOV, or 3GP from your camera app.';
    default:
      return null;
  }
}

/**
 * Read video duration in seconds via browser metadata APIs.
 * @param {File} file
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<number>}
 */
export function getVideoDuration(file, { timeoutMs = METADATA_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(
        reject,
        new Error('Reading the video took too long. Try a shorter MP4 file or pick a different video.'),
      );
    }, timeoutMs);

    const onSuccess = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        finish(reject, new Error('Could not determine video length. Please try a different file.'));
        return;
      }
      finish(resolve, duration);
    };

    video.onloadedmetadata = onSuccess;
    video.ondurationchange = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        onSuccess();
      }
    };
    video.onerror = () => {
      const specific = formatMediaError(video);
      finish(
        reject,
        new Error(specific ?? 'Could not read video metadata. Please try a different file.'),
      );
    };

    video.src = url;
  });
}

/**
 * Resolve duration when possible; allow known video types through when metadata cannot be read.
 * @param {File} file
 * @returns {Promise<{ duration: number|null, durationVerified: boolean }>}
 */
export async function resolveVideoDuration(file) {
  try {
    const duration = await getVideoDuration(file);
    return { duration, durationVerified: true };
  } catch (err) {
    if (!isAllowedVideoFile(file)) {
      throw new Error(
        err.message.includes('format') || err.message.includes('codec')
          ? err.message
          : 'Please choose an MP4, MOV, or 3GP video file.',
      );
    }
    return { duration: null, durationVerified: false };
  }
}
