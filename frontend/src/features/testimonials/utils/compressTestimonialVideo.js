/**
 * Compress a result video to a max byte size using MediaRecorder.
 * Files already under the cap are returned unchanged.
 */

export const DEFAULT_AUDIO_BITRATE = 48_000;
export const MIN_VIDEO_BITRATE = 120_000;
export const MAX_VIDEO_BITRATE = 2_500_000;
export const COMPRESS_MAX_LONG_EDGE = 1280;
export const COMPRESS_MAX_SHORT_EDGE = 720;
const COMPRESS_TIMEOUT_MS = 180000;

/**
 * @param {{ durationSec: number, maxBytes: number, audioBitrate?: number }} opts
 * @returns {number}
 */
export function computeTargetVideoBitrate({
  durationSec,
  maxBytes,
  audioBitrate = DEFAULT_AUDIO_BITRATE,
}) {
  const duration = Math.max(1, Number(durationSec) || 1);
  const budgetBits = Math.max(1, Number(maxBytes) || 1) * 8 * 0.85;
  const videoBits = Math.floor(budgetBits / duration) - audioBitrate;
  return Math.max(MIN_VIDEO_BITRATE, Math.min(MAX_VIDEO_BITRATE, videoBits));
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {{ width: number, height: number }}
 */
export function scaledVideoSize(width, height) {
  const srcW = Math.max(2, Number(width) || COMPRESS_MAX_SHORT_EDGE);
  const srcH = Math.max(2, Number(height) || COMPRESS_MAX_LONG_EDGE);
  const longEdge = Math.max(srcW, srcH);
  const shortEdge = Math.min(srcW, srcH);
  if (longEdge <= COMPRESS_MAX_LONG_EDGE && shortEdge <= COMPRESS_MAX_SHORT_EDGE) {
    return { width: even(srcW), height: even(srcH) };
  }
  const scale = Math.min(COMPRESS_MAX_LONG_EDGE / longEdge, COMPRESS_MAX_SHORT_EDGE / shortEdge);
  return { width: even(srcW * scale), height: even(srcH * scale) };
}

function even(value) {
  return Math.max(2, Math.round(Number(value) || 0) & ~1);
}

export function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function canCompressVideo() {
  if (typeof document === 'undefined') return false;
  if (!pickRecorderMimeType()) return false;
  const canvas = document.createElement('canvas');
  return typeof canvas.captureStream === 'function';
}

/**
 * @param {File} file
 * @param {number} maxBytes
 * @returns {Promise<File>}
 */
export async function compressVideoToMaxBytes(file, maxBytes) {
  if (!file) throw new Error('No video file selected.');
  if (typeof file.size === 'number' && file.size > 0 && file.size <= maxBytes) {
    return file;
  }
  if (!canCompressVideo()) {
    return file;
  }

  const mimeType = pickRecorderMimeType();
  try {
    let compressed = await recordCompressedVideo(file, maxBytes, mimeType);
    if (compressed?.size > 0 && compressed.size <= maxBytes) {
      return compressed;
    }
    if (compressed?.size > maxBytes) {
      const retry = await recordCompressedVideo(file, maxBytes, mimeType, MIN_VIDEO_BITRATE);
      if (retry?.size > 0 && retry.size <= maxBytes) return retry;
      if (retry?.size > 0 && retry.size < compressed.size) compressed = retry;
    }
    if (compressed?.size > 0 && compressed.size < file.size) return compressed;
  } catch {
    return file;
  }
  return file;
}

function captureStreamFromVideo(video) {
  if (typeof video.captureStream === 'function') return video.captureStream();
  if (typeof video.mozCaptureStream === 'function') return video.mozCaptureStream();
  return null;
}

function waitForVideoReady(video, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Reading the video took too long. Please try a shorter clip.'));
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    if (video.readyState >= 2 && Number.isFinite(video.duration) && video.duration > 0) {
      done();
      return;
    }
    video.onloadedmetadata = done;
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error('This video format is not supported. Please use an MP4 from Camera or Gallery.'));
    };
  });
}

/**
 * @param {File} file
 * @param {number} maxBytes
 * @param {string} mimeType
 * @param {number} [bitrateOverride]
 * @returns {Promise<File>}
 */
async function recordCompressedVideo(file, maxBytes, mimeType, bitrateOverride) {
  const objectUrl = URL.createObjectURL(file);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none;overflow:hidden';
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;
  const canvas = document.createElement('canvas');
  host.appendChild(video);
  host.appendChild(canvas);
  if (document.body) document.body.appendChild(host);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    if (host.parentNode) host.parentNode.removeChild(host);
    throw new Error('Could not compress this video. Please try another file.');
  }

  let recorder = null;
  let rafId = 0;

  try {
    await waitForVideoReady(video, 20000);
    const size = scaledVideoSize(video.videoWidth, video.videoHeight);
    canvas.width = size.width;
    canvas.height = size.height;

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 30;
    const videoBitsPerSecond = bitrateOverride || computeTargetVideoBitrate({
      durationSec: duration,
      maxBytes,
    });

    video.volume = 0;
    video.currentTime = 0;
    await video.play();

    const canvasStream = canvas.captureStream(24);
    const liveStream = captureStreamFromVideo(video);
    const audioTracks = liveStream?.getAudioTracks?.() || [];
    const mixed = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioTracks,
    ]);

    const chunks = [];
    recorder = new MediaRecorder(mixed, {
      mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond: DEFAULT_AUDIO_BITRATE,
    });
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('Could not compress this video. Please try another file.'));
    });

    recorder.start(250);

    await Promise.race([
      new Promise((resolve, reject) => {
        const draw = () => {
          if (video.ended || video.paused) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            resolve();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          rafId = requestAnimationFrame(draw);
        };
        video.onended = () => resolve();
        video.onerror = () => reject(new Error('Could not compress this video. Please try another file.'));
        draw();
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Compressing the video took too long. Please try a shorter clip.'));
        }, COMPRESS_TIMEOUT_MS);
      }),
    ]);

    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;

    audioTracks.forEach((track) => {
      try { track.stop(); } catch { /* ignore */ }
    });
    canvasStream.getTracks().forEach((track) => {
      try { track.stop(); } catch { /* ignore */ }
    });

    const blob = new Blob(chunks, { type: mimeType.split(';')[0] || 'video/mp4' });
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
    return new File([blob], `result.${ext}`, { type: blob.type || 'video/mp4' });
  } finally {
    if (rafId) cancelAnimationFrame(rafId);
    try { video.pause(); } catch { /* ignore */ }
    video.removeAttribute('src');
    try { video.load(); } catch { /* ignore */ }
    URL.revokeObjectURL(objectUrl);
    if (host.parentNode) host.parentNode.removeChild(host);
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* ignore */ }
    }
  }
}
