/**
 * Body Parameters Card list pagination — pure helpers.
 */

export const BPC_LIST_DEFAULT_PAGE_SIZE = 20;
export const BPC_LIST_MAX_PAGE_SIZE = 100;

/**
 * @param {object} raw
 * @returns {{ page: number, limit: number, search: string }}
 */
export function normalizeBpcListPagination(raw = {}) {
  let page = 1;
  if (raw.page != null && raw.page !== '') {
    const n = Number.parseInt(String(raw.page), 10);
    if (Number.isFinite(n) && n >= 1) page = n;
  }

  let limit = BPC_LIST_DEFAULT_PAGE_SIZE;
  if (raw.limit != null && raw.limit !== '') {
    const n = Number.parseInt(String(raw.limit), 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, BPC_LIST_MAX_PAGE_SIZE);
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
export function buildBpcListPaginationMeta(totalRecords, page, pageSize) {
  const total = Math.max(0, Number(totalRecords) || 0);
  const size = Math.max(1, Number(pageSize) || BPC_LIST_DEFAULT_PAGE_SIZE);
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
 * Filter slim card rows by name or phone.
 * @template T
 * @param {T[]} records
 * @param {string} searchNormalized
 * @returns {T[]}
 */
export function filterBpcListRecords(records, searchNormalized) {
  const list = Array.isArray(records) ? records : [];
  if (!searchNormalized) return list;
  const q = searchNormalized;
  return list.filter((card) => {
    const name = String(card?.name || '').toLowerCase();
    const phone = String(card?.phoneNumber || '').toLowerCase();
    return name.includes(q) || phone.includes(q);
  });
}

/**
 * @template T
 * @param {T[]} records
 * @param {{ page?: number, limit?: number, search?: string }} opts
 * @returns {{ records: T[], pagination: ReturnType<typeof buildBpcListPaginationMeta> }}
 */
export function paginateBpcListRecords(records, opts = {}) {
  const { page, limit, search } = normalizeBpcListPagination(opts);
  const filtered = filterBpcListRecords(records, search);
  const totalRecords = filtered.length;
  const pagination = buildBpcListPaginationMeta(totalRecords, page, limit);
  const offset = (pagination.currentPage - 1) * pagination.pageSize;
  return {
    records: filtered.slice(offset, offset + pagination.pageSize),
    pagination,
  };
}
