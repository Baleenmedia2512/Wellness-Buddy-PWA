/**
 * frontend/src/shared/services/captureQueue.js
 * ---------------------------------------------------------------------------
 * Offline capture queue.
 *
 * When the device has no internet, photos are queued here instead of being
 * submitted immediately. When connectivity is restored, App.js processes all
 * queued items automatically through the normal capture + AI pipeline.
 * Supports continuous shooting — multiple photos can be queued in a row.
 *
 * Storage: localStorage.
 * A compressed 800px JPEG is ~150–200 KB of base64 text for AI; DB persistence
 * uses toStorageThumbnail (~22 KB). Offline queue keeps the AI-size image so
 * analysis quality is preserved when the device comes back online. 5 MB
 * localStorage leaves room for ~20 queued photos.
 * allows ~25 photos. MAX_SIZE caps at 20 to leave headroom.
 * ---------------------------------------------------------------------------
 */

const QUEUE_KEY = 'wv_offline_capture_queue';
const MAX_SIZE  = 20;

/**
 * Add a capture to the offline queue.
 * @param {{ imageBase64: string, userId: string|null, exifTimestamp: string|null }} item
 * @returns {number} New queue length, or -1 if the queue is full.
 */
export function enqueue({ imageBase64, userId, exifTimestamp }) {
  const queue = _load();
  if (queue.length >= MAX_SIZE) return -1;
  queue.push({
    imageBase64,
    userId:         userId        ?? null,
    exifTimestamp:  exifTimestamp ?? null,
    queuedAt:       Date.now(),
  });
  _save(queue);
  return queue.length;
}

/**
 * Remove and return all queued items, clearing the queue.
 * @returns {Array}
 */
export function flush() {
  const queue = _load();
  if (queue.length === 0) return [];
  _save([]);
  return queue;
}

/**
 * Number of items currently in the queue.
 * @returns {number}
 */
export function size() {
  return _load().length;
}

// ── Private ───────────────────────────────────────────────────────────────────

function _load() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function _save(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    // localStorage full — clear rather than silently failing.
    console.warn('[CaptureQueue] localStorage full, clearing queue:', err);
    try { localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ }
  }
}
