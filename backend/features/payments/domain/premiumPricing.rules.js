/**
 * Premium charge by Community Position (EventLevel) + GST.
 * Defaults live here; ops can override via env without a code change:
 *   PREMIUM_GST_RATE=0.18
 *   PREMIUM_LEVEL_BASES={"PC":199,"ASSOCIATE":199,"SV":299,...}
 * Domain helpers stay pure when `env` / `pricing` is passed in.
 */

export const PREMIUM_GST_RATE = 0.18;

/** Default base rupees before GST (used when env is empty / invalid). */
export const PREMIUM_BASE_BY_LEVEL = Object.freeze({
  PC: 199,
  ASSOCIATE: 199,
  SV: 299,
  WT: 499,
  AWT: 499,
  GET: 699,
  'GET 2500': 699,
  MILL: 899,
  'MILL 7500': 899,
  PT: 999,
  // Legacy renamed codes (still priced if EventLevel was not migrated yet)
  'GET TEAM': 699,
  '2500 GET TEAM': 699,
  'MILL TEAM': 899,
});

/** Old Community Position codes → current UI / catalog codes. */
export const PREMIUM_LEVEL_CODE_ALIASES = Object.freeze({
  'GET TEAM': 'GET',
  '2500 GET TEAM': 'GET 2500',
  'MILL TEAM': 'MILL',
});

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePremiumLevelCode(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalizePremiumLevelCode(value) {
  const code = normalizePremiumLevelCode(value);
  if (!code) return '';
  return PREMIUM_LEVEL_CODE_ALIASES[code] || code;
}

/**
 * @param {number} rupees
 * @returns {number}
 */
export function roundPremiumRupees(rupees) {
  return Math.round(Number(rupees) * 100) / 100;
}

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parsePremiumGstRate(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) return null;
  return rate;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, number>}
 */
export function parsePremiumLevelBases(raw) {
  if (raw == null || String(raw).trim() === '') return {};
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  /** @type {Record<string, number>} */
  const out = {};
  for (const [key, value] of Object.entries(parsed)) {
    const code = normalizePremiumLevelCode(key);
    const base = roundPremiumRupees(value);
    if (!code || !Number.isFinite(base) || base < 1) continue;
    out[code] = base;
  }
  return out;
}

/**
 * @param {{ gstRate?: unknown, levelBases?: unknown }} [input]
 * @returns {{ bases: Record<string, number>, gstRate: number }}
 */
export function buildPremiumPricingConfig(input = {}) {
  const overrides = parsePremiumLevelBases(input.levelBases);
  const gstRate = parsePremiumGstRate(input.gstRate) ?? PREMIUM_GST_RATE;
  return {
    bases: { ...PREMIUM_BASE_BY_LEVEL, ...overrides },
    gstRate,
  };
}

/**
 * Read pricing from env-shaped object (defaults if unset / invalid).
 * @param {Record<string, unknown>|NodeJS.ProcessEnv} [env]
 */
export function parsePremiumPricingFromEnv(env = {}) {
  return buildPremiumPricingConfig({
    gstRate: env.PREMIUM_GST_RATE,
    levelBases: env.PREMIUM_LEVEL_BASES,
  });
}

/** Live process.env wrapper for handlers. */
export function getPremiumPricingConfig() {
  return parsePremiumPricingFromEnv(process.env);
}

/**
 * @param {number} baseAmount
 * @param {number} [gstRate]
 * @returns {{ baseAmount: number, gstAmount: number, totalAmount: number, gstRate: number }}
 */
export function applyPremiumGst(baseAmount, gstRate = PREMIUM_GST_RATE) {
  const base = roundPremiumRupees(baseAmount);
  const rate = Number(gstRate);
  const gstAmount = roundPremiumRupees(base * rate);
  const totalAmount = roundPremiumRupees(base + gstAmount);
  return { baseAmount: base, gstAmount, totalAmount, gstRate: rate };
}

/**
 * @param {unknown} eventLevel
 * @param {{ bases?: Record<string, number>, gstRate?: number }} [pricing]
 * @returns {{
 *   positionCode: string,
 *   baseAmount: number,
 *   gstAmount: number,
 *   totalAmount: number,
 *   gstRate: number,
 * }|null}
 */
export function resolvePremiumQuote(eventLevel, pricing = null) {
  const config = pricing && typeof pricing === 'object'
    ? {
        bases: pricing.bases || PREMIUM_BASE_BY_LEVEL,
        gstRate: pricing.gstRate ?? PREMIUM_GST_RATE,
      }
    : { bases: PREMIUM_BASE_BY_LEVEL, gstRate: PREMIUM_GST_RATE };

  const rawCode = normalizePremiumLevelCode(eventLevel);
  const positionCode = canonicalizePremiumLevelCode(rawCode);
  if (!positionCode) return null;
  const base = config.bases[positionCode] ?? config.bases[rawCode];
  if (base == null) return null;
  return {
    positionCode,
    ...applyPremiumGst(base, config.gstRate),
  };
}

/**
 * Distinct payable totals (after GST) accepted when confirming a Cashfree order.
 * @param {{ bases?: Record<string, number>, gstRate?: number }} [pricing]
 * @returns {number[]}
 */
export function listPremiumPayableTotals(pricing = null) {
  const config = pricing && typeof pricing === 'object'
    ? {
        bases: pricing.bases || PREMIUM_BASE_BY_LEVEL,
        gstRate: pricing.gstRate ?? PREMIUM_GST_RATE,
      }
    : { bases: PREMIUM_BASE_BY_LEVEL, gstRate: PREMIUM_GST_RATE };

  const totals = new Set();
  for (const base of Object.values(config.bases)) {
    totals.add(applyPremiumGst(base, config.gstRate).totalAmount);
  }
  return [...totals].sort((a, b) => a - b);
}

/**
 * @param {unknown} amount
 * @param {number[]} [allowedTotals]
 * @returns {boolean}
 */
export function isAllowedPremiumTotal(amount, allowedTotals = listPremiumPayableTotals()) {
  const paidPaise = Math.round(Number(amount) * 100);
  if (!Number.isFinite(paidPaise)) return false;
  return allowedTotals.some((total) => Math.round(Number(total) * 100) === paidPaise);
}
