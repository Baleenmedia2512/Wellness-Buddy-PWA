/**
 * Activity Report weight arrows: prefer API `previousWeight`, else infer from
 * earlier same-member rows already loaded on the page (remote APIs that omit
 * the field still show ↑/↓ when multiple days are visible).
 */

function parseKg(value) {
  if (value === null || value === undefined || value === '' || value === 'N/A') {
    return null;
  }
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function recordSortKey(record) {
  return `${record?.date || ''} ${record?.time || ''}`;
}

/**
 * @param {Array<object>|null|undefined} records
 * @returns {Array<object>}
 */
export function enrichActivityReportWeightDeltas(records) {
  if (!Array.isArray(records) || records.length === 0) return records || [];

  /** @type {Map<string, Array<{ record: object, index: number }>>} */
  const byUser = new Map();
  records.forEach((record, index) => {
    const key = String(record?.userId ?? '');
    const list = byUser.get(key);
    if (list) list.push({ record, index });
    else byUser.set(key, [{ record, index }]);
  });

  /** @type {Map<number, number|null>} */
  const inferredPreviousByIndex = new Map();
  for (const list of byUser.values()) {
    list.sort((a, b) => recordSortKey(a.record).localeCompare(recordSortKey(b.record)));
    let previousKg = null;
    for (const { record, index } of list) {
      inferredPreviousByIndex.set(index, previousKg);
      const kg = parseKg(record.weight);
      if (kg != null) previousKg = kg;
    }
  }

  return records.map((record, index) => {
    const fromApi = parseKg(record.previousWeight);
    if (fromApi != null) return record;
    const inferred = inferredPreviousByIndex.get(index);
    if (inferred == null && record.previousWeight == null) {
      return { ...record, previousWeight: null };
    }
    if (inferred == null) return record;
    return { ...record, previousWeight: inferred };
  });
}
