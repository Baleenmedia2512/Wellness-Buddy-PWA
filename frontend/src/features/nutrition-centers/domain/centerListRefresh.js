/**
 * Drop clubs the user just deleted so a stale list response cannot paint them again.
 * @param {Array<{ id?: number|string }>|null|undefined} rows
 * @param {Set<number|string>|Array<number|string>|null|undefined} removedIds
 * @returns {Array}
 */
export function omitRemovedCenters(rows, removedIds) {
  const list = Array.isArray(rows) ? rows : [];
  const ids = removedIds instanceof Set ? removedIds : new Set(removedIds || []);
  if (!ids.size) return list;
  return list.filter((center) => !ids.has(center?.id));
}
