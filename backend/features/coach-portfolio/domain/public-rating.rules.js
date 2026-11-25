/**
 * Public coach-page star ratings (1–5, no comments).
 */
import crypto from 'crypto';

/**
 * @param {unknown} raw
 * @returns {number|null} integer 1–5, or null if invalid
 */
export function clampPublicStarRating(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

/**
 * Stable anonymous key from request + page (not a login userId).
 * @param {{ ip?: string, userAgent?: string, publicSlug?: string }} parts
 * @returns {string}
 */
export function buildPublicRaterKey({ ip, userAgent, publicSlug } = {}) {
  const payload = [
    String(ip || '').trim(),
    String(userAgent || '').trim().slice(0, 240),
    String(publicSlug || '').trim().toLowerCase(),
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 40);
}

/**
 * @param {unknown} averageRaw
 * @param {unknown} countRaw
 * @returns {{ average: number, count: number, label: string } | null}
 */
export function formatPublicRatingSummary(averageRaw, countRaw) {
  const count = Math.max(0, Math.floor(Number(countRaw) || 0));
  if (count < 1) return null;
  if (averageRaw == null || averageRaw === '') return null;
  const average = Number(averageRaw);
  if (!Number.isFinite(average)) return null;
  const rounded = Math.round(average * 10) / 10;
  const clamped = Math.min(5, Math.max(1, rounded));
  return {
    average: clamped,
    count,
    label: clamped.toFixed(1),
  };
}
