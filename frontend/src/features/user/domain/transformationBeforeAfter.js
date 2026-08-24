/**
 * Before vs After pairing from testimonials_table (not a new table).
 * Front / Left / Right tabs stay; stored before/after maps to Left only.
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

export function selectTransformationBeforeAfter(rows, imageType) {
  const list = filterTransformationHistoryByType(rows, imageType);
  if (list.length === 0) return { before: null, after: null };
  return {
    before: list[0],
    after: list.length > 1 ? list[list.length - 1] : null,
  };
}

/**
 * Map GET /api/testimonials/my-testimonial onto Left history.
 * Incomplete rows copy after_path = before_path — those must not become After.
 */
export function mapTestimonialToCompareHistory(testimonial) {
  if (!testimonial) return [];
  const beforeUrl = testimonial.beforeImageUrl;
  const afterUrl = testimonial.afterImageUrl;
  const incomplete = !testimonial.status || testimonial.status === 'incomplete';
  const rows = [];
  if (isStoredPhoto(beforeUrl)) {
    const bw = testimonial.beforeWeightKg != null ? parseFloat(testimonial.beforeWeightKg) : NaN;
    rows.push({
      id: testimonial.id || 1,
      imageType: 'left',
      imageUrl: String(beforeUrl).trim(),
      weight: Number.isFinite(bw) ? bw : null,
      createdAt: testimonial.createdAt || null,
    });
  }
  const realAfter = !incomplete
    && isStoredPhoto(afterUrl)
    && afterUrl !== beforeUrl;
  if (realAfter) {
    const aw = testimonial.afterWeightKg != null ? parseFloat(testimonial.afterWeightKg) : NaN;
    rows.push({
      id: (testimonial.id || 1) + 1,
      imageType: 'left',
      imageUrl: String(afterUrl).trim(),
      weight: Number.isFinite(aw) ? aw : null,
      createdAt: testimonial.updatedAt || testimonial.createdAt || null,
    });
  }
  return rows;
}

export function overlayPendingCompareHistory(history, pending, snapshotWeightKg) {
  const weight = Number.isFinite(snapshotWeightKg) ? snapshotWeightKg : null;
  const left = filterTransformationHistoryByType(history, 'left');
  let before = left[0] || null;
  let after = left.length > 1 ? left[left.length - 1] : null;

  if (pending?.before && isStoredPhoto(pending.before)) {
    before = {
      id: before?.id || 0,
      imageType: 'left',
      imageUrl: pending.before,
      weight: before?.weight ?? weight,
      createdAt: before?.createdAt || null,
    };
  }
  if (pending?.after && isStoredPhoto(pending.after)) {
    after = {
      id: 999999,
      imageType: 'left',
      imageUrl: pending.after,
      weight,
      createdAt: null,
    };
  }

  const others = (Array.isArray(history) ? history : []).filter((row) => recordType(row) !== 'left');
  const out = others.slice();
  if (before) out.push(before);
  if (after) out.push(after);
  return out;
}

export function formatTransformationRecordWeight(row) {
  const raw = row?.weight != null ? row.weight : row?.weightKg ?? row?.weight_kg;
  const n = raw != null && raw !== '' ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Latest Front/Left/Right images from team_table.transformation_photos. */
export function historyFromLatestSlots(latestSlots) {
  const out = [];
  TRANSFORMATION_COMPARE_TYPES.forEach((type) => {
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

/** Testimonials before/after (with weights) replace Left JSON-only rows. */
export function mergeCompareHistory(slotHistory, testimonialHistory) {
  const fromSlots = Array.isArray(slotHistory) ? slotHistory : [];
  const leftFromTestimonials = filterTransformationHistoryByType(testimonialHistory, 'left');
  const withoutLeft = fromSlots.filter((row) => recordType(row) !== 'left');
  if (leftFromTestimonials.length > 0) return withoutLeft.concat(leftFromTestimonials);
  return fromSlots;
}
