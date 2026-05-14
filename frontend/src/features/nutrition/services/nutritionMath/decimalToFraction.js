/**
 * Format a decimal as a human-friendly fraction string (e.g. 1.5 → "1 1/2",
 * 0.25 → "1/4"). Falls back to a one-decimal string for non-common fractions.
 *
 * Preserves the legacy behavior previously inlined inside generateServingOptions.
 *
 * @param {number} decimal
 * @returns {string}
 */
export function decimalToFraction(decimal) {
  if (decimal % 1 === 0) {
    return decimal.toString();
  }

  const whole = Math.floor(decimal);
  const fractionalPart = decimal - whole;

  const fractions = {
    0.25: "1/4",
    0.5: "1/2",
    0.75: "3/4",
    0.333: "1/3",
    0.667: "2/3",
  };

  for (const [dec, frac] of Object.entries(fractions)) {
    if (Math.abs(fractionalPart - parseFloat(dec)) < 0.01) {
      return whole > 0 ? `${whole} ${frac}` : frac;
    }
  }

  return decimal % 1 === 0 ? decimal.toString() : decimal.toFixed(1);
}
