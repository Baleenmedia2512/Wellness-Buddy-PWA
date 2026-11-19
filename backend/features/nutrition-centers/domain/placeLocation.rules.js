/** Optional area and city. Blank stays empty. Older apps omit both. */

export function normalizePlaceName(raw) {
  if (raw == null) return null;
  const name = String(raw).replace(/[\r\n]/g, ' ').trim();
  if (!name) return null;
  return name.slice(0, 120);
}
