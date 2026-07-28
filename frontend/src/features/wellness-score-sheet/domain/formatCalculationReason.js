/**
 * Sanitize floating-point display noise in wellness score status strings.
 * Handles cached API snapshots that predate backend rounding fixes.
 */
export function formatCalculationReason(reason) {
  if (!reason || typeof reason !== 'string') return reason;
  return reason.replace(/\d+\.\d+/g, (match) => {
    const n = Number(match);
    if (!Number.isFinite(n)) return match;
    return String(parseFloat(n.toFixed(2)));
  });
}
