/**
 * Activity Report pagination — pure helpers (search / sort / page slice).
 * Applied after detail rows are built so meal-window + dedupe rules stay intact.
 */

export const ACTIVITY_REPORT_DEFAULT_PAGE_SIZE = 20;
export const ACTIVITY_REPORT_MAX_PAGE_SIZE = 100;
/** Hard ceiling for export-all responses (safety against runaway payloads). */
export const ACTIVITY_REPORT_EXPORT_MAX = 10_000;
/** Query value for clubName filter when showing Remote (N/A) records only. */
export const ACTIVITY_REPORT_CLUB_REMOTE = '__remote__';

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
  'level',
  'memberType',
]);

/** Discrete table-column filters (legacy: filterColumn + filterValue; stacked: filter_<column>). */
export const ACTIVITY_REPORT_FILTER_COLUMNS = new Set([
  'memberType',
  'level',
  'sponsorName',
  'clubName',
  'idealCoachName',
  'city',
  'village',
]);

export function emptyActivityReportFilterOptions() {
  return {
    memberType: [],
    level: [],
    sponsorName: [],
    clubName: [],
    idealCoachName: [],
    city: [],
    village: [],
  };
}

/**
 * @param {object} raw
 * @returns {{
 *   page: number,
 *   limit: number,
 *   search: string,
 *   sort: string,
 *   sortDir: 'asc'|'desc',
 *   exportAll: boolean,
 *   clubFilter: string,
 * }}
 */
export function normalizeActivityReportClubFilter(raw) {
  const value = String(raw?.clubName ?? raw?.clubFilter ?? '').trim();
  return value;
}

/** Display label for a stored clubName value (N/A → Remote). */
export function formatActivityReportClubDisplay(clubName) {
  if (!clubName || clubName === 'N/A') return 'Remote';
  return String(clubName);
}

/**
 * Unique club display names for dropdown (sorted A–Z; Remote last when present).
 * @param {Array<{ clubName?: string }>} records
 * @returns {string[]}
 */
export function collectActivityReportClubNames(records) {
  const names = new Set();
  let hasRemote = false;
  for (const record of Array.isArray(records) ? records : []) {
    const raw = record?.clubName;
    if (!raw || raw === 'N/A') {
      hasRemote = true;
    } else {
      names.add(String(raw));
    }
  }
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  if (hasRemote) sorted.push('Remote');
  return sorted;
}

function uniqueSortedLabels(values) {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function isBlankFilterLabel(value) {
  const raw = String(value ?? '').trim();
  return !raw || raw === 'N/A' || raw === '—';
}

/**
 * Distinct values for table-column filter dropdowns (from unpaginated rows).
 * @param {object[]} records
 * @returns {ReturnType<typeof emptyActivityReportFilterOptions>}
 */
export function collectActivityReportFilterOptions(records) {
  const options = emptyActivityReportFilterOptions();
  const memberTypes = new Set();
  const levels = new Set();
  const sponsors = new Set();
  const coaches = new Set();
  const cities = new Set();
  const villages = new Set();

  for (const record of Array.isArray(records) ? records : []) {
    const memberType = record?.memberType === 'sponsor' ? 'sponsor' : 'member';
    memberTypes.add(memberType);
    if (record?.level != null && record.level !== '' && Number.isFinite(Number(record.level))) {
      levels.add(String(Number(record.level)));
    }
    if (!isBlankFilterLabel(record?.sponsorName || record?.coachName)) {
      sponsors.add(String(record.sponsorName || record.coachName).trim());
    }
    if (!isBlankFilterLabel(record?.idealCoachName)) {
      coaches.add(String(record.idealCoachName).trim());
    }
    if (!isBlankFilterLabel(record?.city)) {
      cities.add(String(record.city).trim());
    }
    if (!isBlankFilterLabel(record?.village)) {
      villages.add(String(record.village).trim());
    }
  }

  options.memberType = [...memberTypes].sort();
  options.level = [...levels].sort((a, b) => Number(a) - Number(b));
  options.sponsorName = uniqueSortedLabels(sponsors);
  options.clubName = collectActivityReportClubNames(records);
  options.idealCoachName = uniqueSortedLabels(coaches);
  options.city = uniqueSortedLabels(cities);
  options.village = uniqueSortedLabels(villages);
  return options;
}

export function normalizeActivityReportColumnFilter(raw = {}) {
  const column = String(raw.filterColumn || raw.column || '').trim();
  const value = String(raw.filterValue ?? raw.columnValue ?? '').trim();
  if (!ACTIVITY_REPORT_FILTER_COLUMNS.has(column) || !value) {
    return { filterColumn: '', filterValue: '' };
  }
  return { filterColumn: column, filterValue: value };
}

/**
 * Stacked facet filters (AND). Additive `filter_<column>` params plus legacy
 * filterColumn/filterValue. Missing params stay empty so old clients are unchanged.
 *
 * @param {object} raw
 * @returns {Record<string, string>}
 */
export function normalizeActivityReportColumnFilters(raw = {}) {
  const applied = {};
  for (const key of Object.keys(raw || {})) {
    if (!key.startsWith('filter_')) continue;
    const column = key.slice('filter_'.length);
    const value = String(raw[key] ?? '').trim();
    if (ACTIVITY_REPORT_FILTER_COLUMNS.has(column) && value) {
      applied[column] = value;
    }
  }
  const { filterColumn, filterValue } = normalizeActivityReportColumnFilter(raw);
  if (filterColumn && filterValue && !applied[filterColumn]) {
    applied[filterColumn] = filterValue;
  }
  return applied;
}

export function activityReportColumnFiltersCacheToken(columnFilters = {}) {
  return Object.keys(columnFilters)
    .sort()
    .map((key) => `${key}=${columnFilters[key]}`)
    .join('&');
}

/**
 * Apply every selected facet (AND). Empty map = no-op.
 * @template T
 * @param {T[]} records
 * @param {Record<string, string>} columnFilters
 * @returns {T[]}
 */
export function filterActivityReportRecordsByColumns(records, columnFilters) {
  let list = Array.isArray(records) ? records : [];
  const entries = Object.entries(columnFilters || {});
  if (entries.length === 0) return list;
  for (const [column, value] of entries) {
    list = filterActivityReportRecordsByColumn(list, column, value);
  }
  return list;
}

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

  const clubFilter = normalizeActivityReportClubFilter(raw);
  const { filterColumn, filterValue } = normalizeActivityReportColumnFilter(raw);
  const columnFilters = normalizeActivityReportColumnFilters(raw);

  return {
    page,
    limit,
    search,
    sort,
    sortDir,
    exportAll,
    clubFilter,
    filterColumn,
    filterValue,
    columnFilters,
  };
}

/**
 * Filter by club name. Empty clubFilter = all clubs.
 * Use ACTIVITY_REPORT_CLUB_REMOTE for N/A / Remote rows.
 * @template T
 * @param {T[]} records
 * @param {string} clubFilter
 * @returns {T[]}
 */
export function filterActivityReportRecordsByClub(records, clubFilter) {
  const list = Array.isArray(records) ? records : [];
  const filter = String(clubFilter || '').trim();
  if (!filter) return list;

  if (filter === ACTIVITY_REPORT_CLUB_REMOTE) {
    return list.filter((record) => {
      const raw = record?.clubName;
      return !raw || raw === 'N/A';
    });
  }

  const target = filter.toLowerCase();
  return list.filter((record) => {
    const raw = record?.clubName;
    if (!raw || raw === 'N/A') return false;
    return String(raw).toLowerCase() === target;
  });
}

/**
 * Exact-match filter for one table column. Empty column/value = no-op.
 * @template T
 * @param {T[]} records
 * @param {string} filterColumn
 * @param {string} filterValue
 * @returns {T[]}
 */
export function filterActivityReportRecordsByColumn(records, filterColumn, filterValue) {
  const list = Array.isArray(records) ? records : [];
  const column = String(filterColumn || '').trim();
  const value = String(filterValue || '').trim();
  if (!ACTIVITY_REPORT_FILTER_COLUMNS.has(column) || !value) return list;

  if (column === 'clubName') {
    const clubValue = value === 'Remote' ? ACTIVITY_REPORT_CLUB_REMOTE : value;
    return filterActivityReportRecordsByClub(list, clubValue);
  }

  if (column === 'memberType') {
    const wanted = value.toLowerCase() === 'sponsor' ? 'sponsor' : 'member';
    return list.filter((record) => (
      record?.memberType === 'sponsor' ? 'sponsor' : 'member'
    ) === wanted);
  }

  if (column === 'level') {
    return list.filter((record) => String(record?.level) === value);
  }

  const target = value.toLowerCase();
  return list.filter((record) => {
    let raw = record?.[column];
    if (column === 'sponsorName') raw = record?.sponsorName || record?.coachName;
    if (isBlankFilterLabel(raw)) return false;
    return String(raw).trim().toLowerCase() === target;
  });
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
      record.memberType,
      record.level == null ? '' : String(record.level),
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
 * @param {{ page: number, limit: number, search: string, sort: string, sortDir: 'asc'|'desc', exportAll: boolean, clubFilter?: string }} opts
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
    clubFilter,
    columnFilters,
  } = normalizeActivityReportPagination(opts);

  const byClub = filterActivityReportRecordsByClub(records, clubFilter);
  const byColumn = filterActivityReportRecordsByColumns(byClub, columnFilters);
  const filtered = filterActivityReportRecords(byColumn, search);
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
