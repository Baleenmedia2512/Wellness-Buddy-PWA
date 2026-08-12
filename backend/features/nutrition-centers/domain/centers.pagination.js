/**
 * Physical Club Report pagination — pure helpers (search / sort / page slice).
 */

export const CENTERS_LIST_DEFAULT_PAGE_SIZE = 20;
export const CENTERS_LIST_MAX_PAGE_SIZE = 100;

/**
 * @param {object} raw
 * @returns {{ page: number, limit: number, search: string }}
 */
export function normalizeCentersListPagination(raw = {}) {
  let page = 1;
  if (raw.page != null && raw.page !== '') {
    const n = Number.parseInt(String(raw.page), 10);
    if (Number.isFinite(n) && n >= 1) page = n;
  }

  let limit = CENTERS_LIST_DEFAULT_PAGE_SIZE;
  if (raw.limit != null && raw.limit !== '') {
    const n = Number.parseInt(String(raw.limit), 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, CENTERS_LIST_MAX_PAGE_SIZE);
    }
  }

  const search = String(raw.search || '').trim().toLowerCase();
  return { page, limit, search };
}

/**
 * @param {number} totalRecords
 * @param {number} page
 * @param {number} pageSize
 */
export function buildCentersListPaginationMeta(totalRecords, page, pageSize) {
  const total = Math.max(0, Number(totalRecords) || 0);
  const size = Math.max(1, Number(pageSize) || CENTERS_LIST_DEFAULT_PAGE_SIZE);
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
 * @template T
 * @param {T[]} records
 * @param {string} searchNormalized
 * @returns {T[]}
 */
export function filterCentersListRecords(records, searchNormalized) {
  const list = Array.isArray(records) ? records : [];
  if (!searchNormalized) return list;
  const q = searchNormalized;
  return list.filter((center) => {
    const name = String(center?.center_name || '').toLowerCase();
    const owner = String(center?.ownerName || '').toLowerCase();
    return name.includes(q) || owner.includes(q);
  });
}

/**
 * Default sort: attendance DESC, then name ASC for stable ordering.
 * @template T
 * @param {T[]} records
 * @returns {T[]}
 */
export function sortCentersListRecords(records) {
  const list = Array.isArray(records) ? [...records] : [];
  list.sort((a, b) => {
    const aAtt = Number(a?.todayAttendance) || 0;
    const bAtt = Number(b?.todayAttendance) || 0;
    if (bAtt !== aAtt) return bAtt - aAtt;
    return String(a?.center_name || '').localeCompare(String(b?.center_name || ''));
  });
  return list;
}

/**
 * Map a centre row to the slim list payload (no unnecessary metadata).
 * @param {object} center
 */
export function toCentersListSummary(center) {
  return {
    id: center.id,
    center_name: center.center_name,
    ownerName: center.ownerName || 'Unknown',
    todayAttendance: Number(center.todayAttendance) || 0,
    attendancePercentage: Number(center.attendancePercentage) || 0,
    latitude: center.latitude,
    longitude: center.longitude,
    // Required for existing Call / WhatsApp / Edit UI actions
    owner_phone: center.owner_phone || null,
    owner_user_id: center.owner_user_id,
    education_hour: center.education_hour || null,
  };
}

/**
 * @template T
 * @param {T[]} records
 * @param {{ page?: number, limit?: number, search?: string }} opts
 * @returns {{
 *   records: ReturnType<typeof toCentersListSummary>[],
 *   pagination: ReturnType<typeof buildCentersListPaginationMeta> & {
 *     totalAttendance: number,
 *     attendedCenters: Array<{ id: number, center_name: string, todayAttendance: number }>,
 *   },
 * }}
 */
export function paginateCentersListRecords(records, opts = {}) {
  const { page, limit, search } = normalizeCentersListPagination(opts);
  const filtered = filterCentersListRecords(records, search);
  const prepared = sortCentersListRecords(filtered);
  const totalRecords = prepared.length;
  const totalAttendance = prepared.reduce(
    (sum, c) => sum + (Number(c.todayAttendance) || 0),
    0,
  );
  const attendedCenters = prepared
    .filter((c) => (Number(c.todayAttendance) || 0) > 0)
    .map((c) => ({
      id: c.id,
      center_name: c.center_name,
      todayAttendance: Number(c.todayAttendance) || 0,
    }));

  const pagination = {
    ...buildCentersListPaginationMeta(totalRecords, page, limit),
    totalAttendance,
    attendedCenters,
  };
  const offset = (pagination.currentPage - 1) * pagination.pageSize;
  return {
    records: prepared.slice(offset, offset + pagination.pageSize).map(toCentersListSummary),
    pagination,
  };
}
