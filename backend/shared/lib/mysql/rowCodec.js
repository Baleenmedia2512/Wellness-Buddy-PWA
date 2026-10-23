export function normalizeWriteValue(value, field) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (field?.type === 'Json') {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  if (field?.nativeType === 'Date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  if (field?.type === 'DateTime' || value instanceof Date) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  if (typeof value === 'object' && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

export function normalizeRow(row, table) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    out[key] = normalizeReadValue(value, table.fields.get(key));
  }
  return out;
}

function normalizeReadValue(value, field) {
  if (value == null) return value;
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (value instanceof Date) {
    if (field?.nativeType === 'Date') return value.toISOString().slice(0, 10);
    if (field?.nativeType === 'Time') return value.toISOString().slice(11, 19);
    return value.toISOString();
  }
  if (field?.type === 'Boolean' && (value === 0 || value === 1)) return Boolean(value);
  if (field?.type === 'Decimal' && typeof value?.toString === 'function') {
    const asNumber = Number(value.toString());
    return Number.isFinite(asNumber) ? asNumber : value.toString();
  }
  return value;
}
