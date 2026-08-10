/**
 * Testimonials list pagination — pure helpers (search / upload filter / page slice).
 * Applied after hierarchy + testimonial join so completeness rules stay intact.
 */

export const TESTIMONIALS_LIST_DEFAULT_PAGE_SIZE = 10;
export const TESTIMONIALS_LIST_MAX_PAGE_SIZE = 50;

export const TESTIMONIALS_UPLOAD_FILTERS = new Set([
  'all',
  'fully_uploaded',
  'partial_upload',
  'not_uploaded',
]);

export const TESTIMONIALS_LIST_SCOPES = new Set(['mine', 'direct', 'full']);

/**
 * @param {object} raw
 * @returns {{
 *   page: number,
 *   limit: number,
 *   search: string,
 *   coachId: number|null,
 *   scope: 'mine'|'direct'|'full',
 *   uploadFilter: string,
 * }}
 */
export function normalizeTestimonialsListPagination(raw = {}) {
  let page = 1;
  if (raw.page != null && raw.page !== '') {
    const n = Number.parseInt(String(raw.page), 10);
    if (Number.isFinite(n) && n >= 1) page = n;
  }

  let limit = TESTIMONIALS_LIST_DEFAULT_PAGE_SIZE;
  if (raw.limit != null && raw.limit !== '') {
    const n = Number.parseInt(String(raw.limit), 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, TESTIMONIALS_LIST_MAX_PAGE_SIZE);
    }
  }

  const search = String(raw.search || '').trim().toLowerCase();

  let coachId = null;
  if (raw.coachId != null && raw.coachId !== '') {
    const n = Number.parseInt(String(raw.coachId), 10);
    if (Number.isFinite(n) && n >= 1) coachId = n;
  }

  const scopeRaw = String(raw.scope || 'direct').toLowerCase();
  const scope = TESTIMONIALS_LIST_SCOPES.has(scopeRaw) ? scopeRaw : 'direct';

  const filterRaw = String(raw.uploadFilter || raw.uploadStatus || 'all').toLowerCase();
  const uploadFilter = TESTIMONIALS_UPLOAD_FILTERS.has(filterRaw) ? filterRaw : 'all';

  return { page, limit, search, coachId, scope, uploadFilter };
}

/**
 * @param {string|null|undefined} path
 * @returns {boolean}
 */
export function isRealImagePath(path) {
  if (!path || typeof path !== 'string') return false;
  return !path.endsWith('_video_only_placeholder.jpg');
}

/**
 * Completeness from raw DB row (no signed URLs required).
 * @param {object|null} t
 * @returns {{ filledCount: number, totalSlots: number, level: string }}
 */
export function computeUploadCompletenessFromRow(t) {
  if (!t) {
    return { filledCount: 0, totalSlots: 5, level: 'not_uploaded' };
  }

  const videoOnly = isRealImagePath(t.before_image_path) === false
    && typeof t.before_image_path === 'string'
    && t.before_image_path.endsWith('_video_only_placeholder.jpg');

  const hasBefore = isRealImagePath(t.before_image_path);
  const hasAfter = isRealImagePath(t.after_image_path)
    && (t.status === 'pending' || t.status === 'verified');
  const hasHealthVideo = !!t.health_video_path;
  const hasBusinessVideo = !!t.business_video_path;
  const issues = t.recovered_health_issues ?? [];
  const hasHealthIssues = Array.isArray(issues) && issues.length > 0;

  // Video-only placeholder with no videos → treat as empty (matches enrich null)
  if (videoOnly && !hasHealthVideo && !hasBusinessVideo) {
    return { filledCount: 0, totalSlots: 5, level: 'not_uploaded' };
  }

  const filledCount = [hasBefore, hasAfter, hasHealthVideo, hasBusinessVideo, hasHealthIssues]
    .filter(Boolean).length;

  let level = 'not_uploaded';
  if (filledCount === 5) level = 'fully_uploaded';
  else if (filledCount > 0) level = 'partial_upload';

  return { filledCount, totalSlots: 5, level };
}

/**
 * @template T
 * @param {Array<{ user: { UserName?: string, userName?: string }, testimonial?: object|null }>} rows
 * @param {string} searchNormalized
 * @returns {typeof rows}
 */
export function filterTestimonialsListBySearch(rows, searchNormalized) {
  if (!searchNormalized) return rows;
  return rows.filter((row) => {
    const name = String(row.user?.UserName ?? row.user?.userName ?? '').toLowerCase();
    return name.includes(searchNormalized);
  });
}

/**
 * @template T
 * @param {Array<{ testimonial: object|null, uploadLevel?: string }>} rows
 * @param {string} uploadFilter
 * @returns {typeof rows}
 */
export function filterTestimonialsListByUpload(rows, uploadFilter) {
  if (!uploadFilter || uploadFilter === 'all') return rows;
  return rows.filter((row) => {
    const level = row.uploadLevel
      ?? computeUploadCompletenessFromRow(row.testimonialRaw ?? row.testimonial).level;
    return level === uploadFilter;
  });
}

/**
 * @param {Array} rows
 * @returns {{ fully_uploaded: number, partial_upload: number, not_uploaded: number }}
 */
export function countTestimonialsUploadLevels(rows) {
  return rows.reduce(
    (acc, row) => {
      const level = row.uploadLevel
        ?? computeUploadCompletenessFromRow(row.testimonialRaw ?? row.testimonial).level;
      if (level === 'fully_uploaded') acc.fully_uploaded += 1;
      else if (level === 'partial_upload') acc.partial_upload += 1;
      else acc.not_uploaded += 1;
      return acc;
    },
    { fully_uploaded: 0, partial_upload: 0, not_uploaded: 0 },
  );
}

/**
 * @template T
 * @param {T[]} rows
 * @param {{ page: number, limit: number }} opts
 * @returns {{ pageRows: T[], pagination: object }}
 */
export function paginateTestimonialsList(rows, { page, limit }) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  const pageRows = rows.slice(start, start + limit);

  return {
    pageRows,
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
      hasMore: safePage < totalPages,
      hasPrevious: safePage > 1,
    },
  };
}

/**
 * Map joined member + raw testimonial to lean list fields (no signed URLs yet).
 * @param {{ user: object, testimonial: object|null }} row
 */
export function mapTestimonialsListLeanFields(row) {
  const t = row.testimonial;
  const completeness = computeUploadCompletenessFromRow(t);
  const videoOnly = t && typeof t.before_image_path === 'string'
    && t.before_image_path.endsWith('_video_only_placeholder.jpg');

  if (!t || (videoOnly && !t.health_video_path && !t.business_video_path)) {
    return {
      userId: row.user.UserId,
      userName: row.user.UserName,
      profileImage: null,
      phoneNumber: row.user.PhoneNumber ?? null,
      uploadStatus: 'not_uploaded',
      progress: { filled: 0, total: 5 },
      beforeImagePath: null,
      afterImagePath: null,
      lastUpdated: null,
      testimonialId: null,
      status: null,
      videoStatus: 'none',
      beforeWeightKg: null,
      afterWeightKg: null,
      goalType: null,
      durationText: null,
      verifiedAt: null,
      createdAt: null,
      healthVideoPath: null,
      businessVideoPath: null,
      recoveredHealthIssues: [],
      uploadLevel: 'not_uploaded',
    };
  }

  return {
    userId: row.user.UserId,
    userName: row.user.UserName,
    profileImage: null,
    phoneNumber: row.user.PhoneNumber ?? null,
    uploadStatus: completeness.level,
    progress: { filled: completeness.filledCount, total: completeness.totalSlots },
    beforeImagePath: videoOnly ? null : (t.before_image_path || null),
    afterImagePath: videoOnly ? null : (t.after_image_path || null),
    lastUpdated: t.updated_at ?? t.created_at ?? null,
    testimonialId: t.id,
    status: t.status,
    videoStatus: t.video_status ?? 'none',
    beforeWeightKg: videoOnly ? null : t.before_weight_kg,
    afterWeightKg: videoOnly ? null : t.after_weight_kg,
    goalType: videoOnly ? null : t.goal_type,
    durationText: videoOnly ? null : t.duration_text,
    verifiedAt: t.verified_at,
    createdAt: t.created_at,
    healthVideoPath: t.health_video_path ?? null,
    businessVideoPath: t.business_video_path ?? null,
    recoveredHealthIssues: t.recovered_health_issues ?? [],
    uploadLevel: completeness.level,
  };
}
