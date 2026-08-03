/**
 * Pure diary feed deduplication:
 * 1. Hide stale pending-analysis rows when a terminal entry exists for the capture.
 * 2. Collapse duplicate pending-analysis rows for the same capture ID.
 */

function entryCaptureId(entry) {
  const id = entry.capture?.id ?? entry.payload?.id;
  if (id == null || String(id) === '') return '';
  return String(id);
}

function isPendingAnalysisEntry(entry) {
  return entry.kind === 'unknown' && entry.payload?.isPendingAnalysis === true;
}

/**
 * @param {Array<{ kind: string, capture?: { id?: string|number|null }|null, payload?: { id?: string|number|null, isPendingAnalysis?: boolean } }>} entries
 * @returns {typeof entries}
 */
export function dedupePendingDiaryEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return entries;

  const resolvedCaptureIds = new Set();
  for (const entry of entries) {
    if (isPendingAnalysisEntry(entry)) continue;
    const captureId = entryCaptureId(entry);
    if (captureId !== '') resolvedCaptureIds.add(captureId);
  }

  const seenPendingCaptureIds = new Set();
  return entries.filter((entry) => {
    if (!isPendingAnalysisEntry(entry)) return true;

    const captureId = entryCaptureId(entry);
    if (captureId === '') return true;
    if (resolvedCaptureIds.has(captureId)) return false;
    if (seenPendingCaptureIds.has(captureId)) return false;
    seenPendingCaptureIds.add(captureId);
    return true;
  });
}
