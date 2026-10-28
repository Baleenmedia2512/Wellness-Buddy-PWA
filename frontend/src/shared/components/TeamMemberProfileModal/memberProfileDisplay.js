/**
 * Read-only formatting for the diary team-member profile sheet.
 */
import { PHYSICAL_ACTIVITY_OPTIONS } from '../../utils/tdeeCalculations.js';

export const TRANSFORMATION_SLOTS = Object.freeze([
  { key: 'left', label: 'Left' },
  { key: 'front', label: 'Front' },
  { key: 'right', label: 'Right' },
]);

export const BODY_METRIC_FIELDS = Object.freeze([
  { key: 'age', label: 'Age' },
  { key: 'fatPercent', label: 'Fat %' },
  { key: 'visceralFat', label: 'V-Fat' },
  { key: 'bmi', label: 'BMI' },
  { key: 'bodyAge', label: 'Body Age' },
  { key: 'chestCm', label: 'Chest' },
  { key: 'waistCm', label: 'Waist' },
  { key: 'hipCm', label: 'Hip' },
]);

/**
 * Avatar and transformation photos are data URIs, https URLs, or `/api/media/...` on the API host.
 * @param {unknown} value
 * @param {string} [apiBaseUrl]
 * @returns {string}
 */
export function mediaImageSrc(value, apiBaseUrl = '') {
  if (typeof value !== 'string') return '';
  const src = value.trim();
  if (!src) return '';
  if (src.startsWith('data:image/')) return src;
  if (src.startsWith('https://') || src.startsWith('http://')) return src;
  if (src.startsWith('/api/')) {
    const base = String(apiBaseUrl || '').replace(/\/+$/, '');
    return base ? `${base}${src}` : src;
  }
  return '';
}

/**
 * @param {unknown} photos
 * @param {string} key
 * @param {string} [apiBaseUrl]
 * @returns {string}
 */
export function transformationPhotoSrc(photos, key, apiBaseUrl = '') {
  const value = photos && typeof photos === 'object' ? photos[key] : null;
  return mediaImageSrc(value, apiBaseUrl);
}

/**
 * @param {unknown} level
 * @returns {string}
 */
export function activityLevelLabel(level) {
  const id = String(level || '').trim();
  if (!id) return '';
  const match = PHYSICAL_ACTIVITY_OPTIONS.find((option) => option.id === id);
  return match?.label || id;
}

/**
 * @param {{ id?: unknown, name?: unknown, options?: Array<{ id?: unknown, name?: unknown }> }|null|undefined} centre
 * @returns {string}
 */
export function workingCentreName(centre) {
  const name = String(centre?.name || '').trim();
  if (name) return name;
  const options = Array.isArray(centre?.options) ? centre.options : [];
  const id = centre?.id != null ? String(centre.id) : '';
  const selected = options.find((opt) => String(opt?.id) === id);
  return String(selected?.name || '').trim();
}

/**
 * @param {unknown} issues
 * @returns {string[]}
 */
export function healthIssueLabels(issues) {
  if (!Array.isArray(issues)) return [];
  return issues.map((item) => String(item || '').trim()).filter(Boolean);
}

/**
 * @param {string} key
 * @param {unknown} raw
 * @returns {string}
 */
export function formatMetricValue(key, raw) {
  if (raw == null || raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return String(raw).trim();
  if (key === 'fatPercent') return `${n}%`;
  if (key === 'chestCm' || key === 'waistCm' || key === 'hipCm') return `${n} cm`;
  if (key === 'age' || key === 'bodyAge') return String(Math.round(n));
  return String(n);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatCalorieTarget(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${Math.round(n)} kcal / day`;
}
