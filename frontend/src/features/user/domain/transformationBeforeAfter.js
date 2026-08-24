/**
 * Before vs After pairing for profile transformation photos.
 * Uses GET /api/user/profile transformationPhotoHistory only — never live Profile Weight.
 */

export const TRANSFORMATION_COMPARE_TYPES = ['front', 'left', 'right'];
export const DEFAULT_TRANSFORMATION_COMPARE_TYPE = 'left';

function isStoredPhoto(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^data:image\/[a-zA-Z0-9+.-]+;base64,/.test(trimmed) || /^https:\/\//i.test(trimmed);
}

function createdAtMs(row) {
  const raw = row?.createdAt || row?.created_at;
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function recordUrl(row) {
  return row?.imageUrl || row?.image_url || null;
}

function recordType(row) {
  return row?.imageType || row?.image_type || null;
}

export function filterTransformationHistoryByType(rows, imageType) {
  if (!TRANSFORMATION_COMPARE_TYPES.includes(imageType)) return [];
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => recordType(row) === imageType && isStoredPhoto(recordUrl(row)))
    .slice()
    .sort((a, b) => {
      const byTime = createdAtMs(a) - createdAtMs(b);
      if (byTime !== 0) return byTime;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
}

/**
 * @param {Array<object>} rows transformationPhotoHistory from profile API
 * @param {string} imageType
 * @returns {{ before: object|null, after: object|null }}
 */
export function selectTransformationBeforeAfter(rows, imageType) {
  const list = filterTransformationHistoryByType(rows, imageType);
  if (list.length === 0) return { before: null, after: null };
  return {
    before: list[0],
    after: list.length > 1 ? list[list.length - 1] : null,
  };
}

/**
 * JSON latest-slot cache (existing users) when history table has no rows.
 * Does not invent weights or extra types.
 */
export function historyWithLatestSlotFallback(history, latestSlots) {
  const out = Array.isArray(history) ? history.slice() : [];
  const present = new Set(
    out.map((row) => recordType(row)).filter((type) => TRANSFORMATION_COMPARE_TYPES.includes(type)),
  );
  TRANSFORMATION_COMPARE_TYPES.forEach((type) => {
    if (present.has(type)) return;
    const url = latestSlots?.[type];
    if (isStoredPhoto(url)) {
      out.push({
        id: 0,
        imageType: type,
        imageUrl: String(url).trim(),
        weight: null,
        createdAt: null,
      });
    }
  });
  return out;
}

export function formatTransformationRecordWeight(row) {
  const raw = row?.weight != null ? row.weight : row?.weightKg ?? row?.weight_kg;
  const n = raw != null && raw !== '' ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}
