/**
 * Diary list pagination helpers (offset/limit over the merged feed).
 */

export const DIARY_LIST_DEFAULT_LIMIT = 20;
export const DIARY_LIST_MAX_LIMIT = 50;
/** Safety cap per vertical SQL read for one calendar day. */
export const DIARY_LIST_SQL_CAP = 500;

/**
 * @param {unknown} rawLimit
 * @param {unknown} rawOffset
 * @returns {{ limit: number, offset: number }}
 */
export function normalizeDiaryPagination(rawLimit, rawOffset) {
  let limit = DIARY_LIST_DEFAULT_LIMIT;
  if (rawLimit != null && rawLimit !== '') {
    const n = Number.parseInt(String(rawLimit), 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, DIARY_LIST_MAX_LIMIT);
    }
  }

  let offset = 0;
  if (rawOffset != null && rawOffset !== '') {
    const n = Number.parseInt(String(rawOffset), 10);
    if (Number.isFinite(n) && n >= 0) offset = n;
  }

  return { limit, offset };
}

/**
 * Slice a newest-first merged diary list and attach pagination meta.
 * @template T
 * @param {T[]} entries
 * @param {{ limit: number, offset: number }} page
 * @returns {{ entries: T[], pagination: {
 *   limit: number, offset: number, total: number, hasMore: boolean, nextOffset: number|null
 * } }}
 */
export function paginateDiaryEntries(entries, { limit, offset }) {
  const list = Array.isArray(entries) ? entries : [];
  const total = list.length;
  const page = list.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < total;
  return {
    entries: page,
    pagination: {
      limit,
      offset,
      total,
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
    },
  };
}
