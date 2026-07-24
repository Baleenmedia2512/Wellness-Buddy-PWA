/**
 * Pure diary feed deduplication — hides stale pending-analysis rows when a
 * terminal domain entry already exists for the same capture ID.
 */

/**
 * @param {Array<{ kind: string, capture?: { id?: string|number|null }|null, payload?: { id?: string|number|null, isPendingAnalysis?: boolean } }>} entries
 * @returns {typeof entries}
 */
export function dedupePendingDiaryEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return entries;

  const resolvedCaptureIds = new Set();
  for (const entry of entries) {
    const isPendingUnknown =
      entry.kind === 'unknown' && entry.payload?.isPendingAnalysis === true;
    if (isPendingUnknown) continue;

    const captureId = entry.capture?.id ?? entry.payload?.id;
    if (captureId != null && String(captureId) !== '') {
      resolvedCaptureIds.add(String(captureId));
    }
  }

  return entries.filter((entry) => {
    const isPendingUnknown =
      entry.kind === 'unknown' && entry.payload?.isPendingAnalysis === true;
    if (!isPendingUnknown) return true;

    const captureId = String(entry.capture?.id ?? entry.payload?.id ?? '');
    if (captureId === '') return true;
    return !resolvedCaptureIds.has(captureId);
  });
}
