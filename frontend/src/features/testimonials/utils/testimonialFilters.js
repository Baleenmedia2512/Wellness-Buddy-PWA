/** Status filter values for testimonial summary chips. */
export const STATUS_FILTERS = {
  ALL: 'all',
  VERIFIED: 'verified',
  PENDING: 'pending',
  MISSING: 'missing',
};

/** Team scope filter values. */
export const TEAM_SCOPES = {
  MINE: 'mine',
  DIRECT: 'direct',
  FULL: 'full',
};

/** Derive a row's testimonial status bucket. */
export function getTestimonialRowStatus(row) {
  if (!row?.testimonial) return STATUS_FILTERS.MISSING;
  if (row.testimonial.status === 'verified') return STATUS_FILTERS.VERIFIED;
  if (row.testimonial.status === 'pending') return STATUS_FILTERS.PENDING;
  return STATUS_FILTERS.MISSING;
}

/** Filter rows by active status chip (all = no filter). */
export function filterRowsByStatus(rows, statusFilter) {
  if (!statusFilter || statusFilter === STATUS_FILTERS.ALL) return rows;
  return rows.filter((row) => getTestimonialRowStatus(row) === statusFilter);
}

/** Count rows per status bucket for summary chips. */
export function countRowsByStatus(rows) {
  return rows.reduce(
    (acc, row) => {
      const status = getTestimonialRowStatus(row);
      if (status === STATUS_FILTERS.VERIFIED) acc.verified += 1;
      else if (status === STATUS_FILTERS.PENDING) acc.pending += 1;
      else acc.missing += 1;
      return acc;
    },
    { verified: 0, pending: 0, missing: 0 },
  );
}

/** Toggle a status chip: clicking the active chip resets to All. */
export function toggleStatusFilter(current, next) {
  return current === next ? STATUS_FILTERS.ALL : next;
}
