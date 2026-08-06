/**
 * Activity Report pagination — pure helpers (search / sort / page slice).
 * Applied after detail rows are built so meal-window + dedupe rules stay intact.
 */

export const ACTIVITY_REPORT_DEFAULT_PAGE_SIZE = 25;
export const ACTIVITY_REPORT_MAX_PAGE_SIZE = 100;
/** Hard ceiling for export-all responses (safety against runaway payloads). */
export const ACTIVITY_REPORT_EXPORT_MAX = 10_000;

export const ACTIVITY_REPORT_SORTABLE = new Set([
  'date',
  'time',
  'memberName',
  'weight',
  'calories',
  'waterLiters',
  'steps',
  'caloriesBurned',
  'clubName',
  'phone',
  'city',
  'village',
  'sponsorName',
  'idealCoachName',
  'coachName',
]);

/**
 * @param {object} raw
 * @returns {{
 *   page: number,
 *   limit: number,
 *   search: string,
 *   sort: string,
 *   sortDir: 'asc'|'desc',
 *   exportAll: boolean,
 * }}
 */
export function normalizeActivityReportPagination(raw = {}) {
  let page = 1;
  if (raw.page != null && raw.page !== '') {
    const n = Number.parseInt(String(raw.page), 10);
    if (Number.isFinite(n) && n >= 1) page = n;
  }

  let limit = ACTIVITY_REPORT_DEFAULT_PAGE_SIZE;
  if (raw.limit != null && raw.limit !== '') {
    const n = Number.parseInt(String(raw.limit), 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, ACTIVITY_REPORT_MAX_PAGE_SIZE);
    }
  }

  const search = String(raw.search || '').trim().toLowerCase();

  let sort = 'date';
  if (raw.sort != null && raw.sort !== '') {
    const candidate = String(raw.sort);
    if (ACTIVITY_REPORT_SORTABLE.has(candidate)) sort = candidate;
  }

  const sortDirRaw = String(raw.sortDir || raw.sortDirection || 'desc').toLowerCase();
  const sortDir = sortDirRaw === 'asc' ? 'asc' : 'desc';

  const exportFlag = raw.exportAll ?? raw.export;
  const exportAll = exportFlag === true
    || exportFlag === 1
    || exportFlag === '1'
    || String(exportFlag || '').toLowerCase() === 'true';

  return { page, limit, search, sort, sortDir, exportAll };
}

/**
 * Filter enriched detail rows by free-text search (name, phone, coach, city, village).
 * @template T
 * @param {T[]} records
 * @param {string} searchNormalized lowercase trimmed query
 * @returns {T[]}
 */
export function filterActivityReportRecords(records, searchNormalized) {
  const list = Array.isArray(records) ? records : [];
  if (!searchNormalized) return list;
  const q = searchNormalized;
  return list.filter((record) => {
    const haystacks = [
      record.memberName,
      record.phone,
      record.sponsorName,
      record.coachName,
      record.idealCoachName,
      record.city,
      record.village,
      record.clubName,
    ];
    return haystacks.some((v) => String(v || '').toLowerCase().includes(q));
  });
}

/**
 * @template T
 * @param {T[]} records
 * @param {string} sortColumn
 * @param {'asc'|'desc'} sortDir
 * @returns {T[]}
 */
export function sortActivityReportRecords(records, sortColumn, sortDir) {
  const list = Array.isArray(records) ? [...records] : [];
  const dir = sortDir === 'asc' ? 1 : -1;
  const col = ACTIVITY_REPORT_SORTABLE.has(sortColumn) ? sortColumn : 'date';

  list.sort((a, b) => {
    let aVal = a?.[col];
    let bVal = b?.[col];

    if (col === 'date' || col === 'time') {
      aVal = aVal || '';
      bVal = bVal || '';
      // Date primary, time secondary for stable newest-first default
      if (col === 'date') {
        const dateCmp = String(aVal).localeCompare(String(bVal));
        if (dateCmp !== 0) return dateCmp * dir;
        const timeCmp = String(a?.time || '').localeCompare(String(b?.time || ''));
        return timeCmp * dir;
      }
      return String(aVal).localeCompare(String(bVal)) * dir;
    }

    if (typeof aVal === 'number' || typeof bVal === 'number') {
      const an = Number(aVal);
      const bn = Number(bVal);
      const aNum = Number.isFinite(an) ? an : null;
      const bNum = Number.isFinite(bn) ? bn : null;
      if (aNum == null && bNum == null) return 0;
      if (aNum == null) return 1;
      if (bNum == null) return -1;
      if (aNum < bNum) return -1 * dir;
      if (aNum > bNum) return 1 * dir;
      return 0;
    }

    aVal = String(aVal ?? '').toLowerCase();
    bVal = String(bVal ?? '').toLowerCase();
    if (aVal < bVal) return -1 * dir;
    if (aVal > bVal) return 1 * dir;
    return 0;
  });

  return list;
}

/**
 * @param {number} totalRecords
 * @param {number} page
 * @param {number} pageSize
 */
export function buildActivityReportPaginationMeta(totalRecords, page, pageSize) {
  const total = Math.max(0, Number(totalRecords) || 0);
  const size = Math.max(1, Number(pageSize) || ACTIVITY_REPORT_DEFAULT_PAGE_SIZE);
  const totalPages = total === 0 ? 0 : Math.ceil(total / size);
  let currentPage = Math.max(1, Number(page) || 1);
  if (totalPages > 0 && currentPage > totalPages) currentPage = totalPages;

  return {
    totalRecords: total,
    totalPages,
    currentPage,
    pageSize: size,
    hasNextPage: totalPages > 0 && currentPage < totalPages,
    hasPreviousPage: currentPage > 1 && total > 0,
  };
}

/**
 * Apply search → sort → page slice. Export mode returns the full filtered set
 * (capped) with pagination metadata reflecting the export page.
 *
 * @template T
 * @param {T[]} records
 * @param {{ page: number, limit: number, search: string, sort: string, sortDir: 'asc'|'desc', exportAll: boolean }} opts
 * @returns {{ records: T[], pagination: ReturnType<typeof buildActivityReportPaginationMeta>, preparedRows: T[] }}
 */
export function paginateActivityReportRecords(records, opts) {
  const {
    page,
    limit,
    search,
    sort,
    sortDir,
    exportAll,
  } = normalizeActivityReportPagination(opts);

  const filtered = filterActivityReportRecords(records, search);
  const preparedRows = sortActivityReportRecords(filtered, sort, sortDir);
  const totalRecords = preparedRows.length;

  if (exportAll) {
    const capped = preparedRows.slice(0, ACTIVITY_REPORT_EXPORT_MAX);
    return {
      records: capped,
      preparedRows,
      pagination: {
        ...buildActivityReportPaginationMeta(totalRecords, 1, capped.length || limit),
        exportAll: true,
        truncated: totalRecords > ACTIVITY_REPORT_EXPORT_MAX,
      },
    };
  }

  const pagination = buildActivityReportPaginationMeta(totalRecords, page, limit);
  const offset = (pagination.currentPage - 1) * pagination.pageSize;
  return {
    records: preparedRows.slice(offset, offset + pagination.pageSize),
    preparedRows,
    pagination,
  };
}

/**
 * Page-slice a list that is already search-filtered and sorted.
 * @template T
 * @param {T[]} preparedRows
 * @param {{ page?: number, limit?: number, exportAll?: boolean }} opts
 */
export function slicePreparedActivityReportRows(preparedRows, opts = {}) {
  const { page, limit, exportAll } = normalizeActivityReportPagination(opts);
  const list = Array.isArray(preparedRows) ? preparedRows : [];
  const totalRecords = list.length;

  if (exportAll) {
    const capped = list.slice(0, ACTIVITY_REPORT_EXPORT_MAX);
    return {
      records: capped,
      pagination: {
        ...buildActivityReportPaginationMeta(totalRecords, 1, capped.length || limit),
        exportAll: true,
        truncated: totalRecords > ACTIVITY_REPORT_EXPORT_MAX,
      },
    };
  }

  const pagination = buildActivityReportPaginationMeta(totalRecords, page, limit);
  const offset = (pagination.currentPage - 1) * pagination.pageSize;
  return {
    records: list.slice(offset, offset + pagination.pageSize),
    pagination,
  };
}
