/** Upload-completeness filter values used in the coach's team list. */
export const UPLOAD_FILTERS = {
  ALL:            'all',
  FULLY_UPLOADED: 'fully_uploaded',
  PARTIAL:        'partial_upload',
  NOT_UPLOADED:   'not_uploaded',
};

/** Team scope filter values. */
export const TEAM_SCOPES = {
  MINE:   'mine',
  DIRECT: 'direct',
  FULL:   'full',
};

// ─── Legacy aliases (kept so existing video-report helpers don't break) ────────
export const STATUS_FILTERS = {
  ALL:      'all',
  VERIFIED: 'verified',
  PENDING:  'pending',
  MISSING:  'missing',
};

/**
 * Check whether a before/after image path is a real photo (not a placeholder).
 * @param {string|null|undefined} path
 */
function isRealImagePath(path) {
  if (!path) return false;
  return !path.endsWith('_video_only_placeholder.jpg');
}

/**
 * Compute how many of the 5 testimonial slots a member has filled.
 * Slots: before photo, after photo, health video, business video, recovered health issues.
 * Returns { filledCount, totalSlots: 5, level: 'not_uploaded'|'partial_upload'|'fully_uploaded' }
 */
export function computeMemberCompleteness(row) {
  const t = row?.testimonial;
  if (!t) return { filledCount: 0, totalSlots: 5, level: UPLOAD_FILTERS.NOT_UPLOADED };

  const hasBeforePhoto   = isRealImagePath(t.beforeImagePath ?? t.before_image_path);
  const hasAfterPhoto    = isRealImagePath(t.afterImagePath  ?? t.after_image_path) &&
                           (t.status === 'pending' || t.status === 'verified');
  const hasHealthVideo   = !!(t.healthVideoPath   ?? t.health_video_path);
  const hasBusinessVideo = !!(t.businessVideoPath ?? t.business_video_path);
  const healthIssues     = t.recoveredHealthIssues ?? t.recovered_health_issues ?? [];
  const hasHealthIssues  = Array.isArray(healthIssues) && healthIssues.length > 0;

  const filledCount = [hasBeforePhoto, hasAfterPhoto, hasHealthVideo, hasBusinessVideo, hasHealthIssues]
    .filter(Boolean).length;

  let level;
  if (filledCount === 0)  level = UPLOAD_FILTERS.NOT_UPLOADED;
  else if (filledCount === 5) level = UPLOAD_FILTERS.FULLY_UPLOADED;
  else                        level = UPLOAD_FILTERS.PARTIAL;

  return { filledCount, totalSlots: 5, level };
}

/** Filter coach rows by upload completeness. */
export function filterRowsByUpload(rows, uploadFilter) {
  if (!uploadFilter || uploadFilter === UPLOAD_FILTERS.ALL) return rows;
  return rows.filter((row) => computeMemberCompleteness(row).level === uploadFilter);
}

/** Count rows per completeness level. */
export function countRowsByUpload(rows) {
  return rows.reduce(
    (acc, row) => {
      const { level } = computeMemberCompleteness(row);
      if      (level === UPLOAD_FILTERS.FULLY_UPLOADED) acc.fully_uploaded += 1;
      else if (level === UPLOAD_FILTERS.PARTIAL)        acc.partial_upload  += 1;
      else                                              acc.not_uploaded    += 1;
      return acc;
    },
    { fully_uploaded: 0, partial_upload: 0, not_uploaded: 0 },
  );
}

/** Member counts per team scope tab (for segmented control labels). */
export function countRowsByTeamScope(mineRow, directRows, fullRows) {
  return {
    [TEAM_SCOPES.MINE]:   mineRow ? 1 : 0,
    [TEAM_SCOPES.DIRECT]: directRows.length,
    [TEAM_SCOPES.FULL]:   fullRows.length,
  };
}

/** Toggle a filter chip: clicking the active chip resets to All. */
export function toggleStatusFilter(current, next) {
  return current === next ? UPLOAD_FILTERS.ALL : next;
}

// ─── Legacy helpers retained for internal slot-level status badges ─────────────

export function getTestimonialRowStatus(row) {
  if (!row?.testimonial) return STATUS_FILTERS.MISSING;
  if (row.testimonial.status === 'verified') return STATUS_FILTERS.VERIFIED;
  if (row.testimonial.status === 'pending')  return STATUS_FILTERS.PENDING;
  return STATUS_FILTERS.MISSING;
}

export function filterRowsByStatus(rows, statusFilter) {
  if (!statusFilter || statusFilter === STATUS_FILTERS.ALL) return rows;
  return rows.filter((row) => getTestimonialRowStatus(row) === statusFilter);
}

export function countRowsByStatus(rows) {
  return rows.reduce(
    (acc, row) => {
      const status = getTestimonialRowStatus(row);
      if      (status === STATUS_FILTERS.VERIFIED) acc.verified += 1;
      else if (status === STATUS_FILTERS.PENDING)  acc.pending  += 1;
      else                                         acc.missing  += 1;
      return acc;
    },
    { verified: 0, pending: 0, missing: 0 },
  );
}

export function getVideoRowStatus(row) {
  if (!row || row.videoStatus === 'none') return STATUS_FILTERS.MISSING;
  if (row.videoStatus === 'verified') return STATUS_FILTERS.VERIFIED;
  if (row.videoStatus === 'pending')  return STATUS_FILTERS.PENDING;
  return STATUS_FILTERS.MISSING;
}

export function filterVideoRowsByStatus(rows, statusFilter) {
  if (!statusFilter || statusFilter === STATUS_FILTERS.ALL) return rows;
  return rows.filter((row) => getVideoRowStatus(row) === statusFilter);
}

export function countVideoRowsByStatus(rows) {
  return rows.reduce(
    (acc, row) => {
      const status = getVideoRowStatus(row);
      if      (status === STATUS_FILTERS.VERIFIED) acc.verified += 1;
      else if (status === STATUS_FILTERS.PENDING)  acc.pending  += 1;
      else                                         acc.missing  += 1;
      return acc;
    },
    { verified: 0, pending: 0, missing: 0 },
  );
}
