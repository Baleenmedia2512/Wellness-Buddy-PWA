/**
 * Full-page loading skeleton unmounts the Mine card and drops in-progress
 * photo drafts. Only show it before the first Mine row exists.
 *
 * @param {boolean} loading
 * @param {object|null|undefined} mineRow
 * @returns {boolean}
 */
export function shouldShowTestimonialsPageSkeleton(loading, mineRow) {
  return Boolean(loading) && mineRow == null;
}
