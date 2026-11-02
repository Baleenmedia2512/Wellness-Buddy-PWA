/**
 * Sanitize floating-point display noise in wellness score status strings.
 * Handles cached API snapshots that predate backend rounding fixes.
 *
 * Macro grams / kcal show as whole numbers (match contribution modals).
 * Other units (mg, mcg, …) keep up to 2 decimal places.
 */
export function formatCalculationReason(reason) {
  if (!reason || typeof reason !== 'string') return reason;

  let out = reason.replace(/(\d+\.\d+)(\s*g)\b/g, (_, num, unit) => {
    const n = Number(num);
    if (!Number.isFinite(n)) return `${num}${unit}`;
    return `${Math.round(n)}${unit}`;
  });

  out = out.replace(/(\d+\.\d+)(\s*kcal)\b/gi, (_, num, unit) => {
    const n = Number(num);
    if (!Number.isFinite(n)) return `${num}${unit}`;
    return `${Math.round(n)}${unit}`;
  });

  return out.replace(/\d+\.\d+/g, (match) => {
    const n = Number(match);
    if (!Number.isFinite(n)) return match;
    return String(parseFloat(n.toFixed(2)));
  });
}
