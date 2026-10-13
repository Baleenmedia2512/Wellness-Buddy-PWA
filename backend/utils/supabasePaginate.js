/**
 * Page past PostgREST / Supabase default max-rows (typically 1000).
 *
 * Callers must pass a factory that returns a fresh query each page so
 * `.range()` is not stacked on a previous builder. Prefer a stable
 * `.order('UserId')` (or similar unique key) on that query.
 *
 * @param {() => { range: (from: number, to: number) => PromiseLike<{ data: any[]|null, error: any }> }} buildQuery
 * @param {{ pageSize?: number }} [opts]
 * @returns {Promise<any[]>}
 */
export async function fetchAllSupabaseRows(buildQuery, opts = {}) {
  const pageSize = Math.max(1, Number(opts.pageSize) || 1000);
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) {
      const err = error instanceof Error ? error : new Error(error.message || 'Supabase query failed');
      if (!(error instanceof Error) && error.code) err.code = error.code;
      err.cause = error;
      throw err;
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}
