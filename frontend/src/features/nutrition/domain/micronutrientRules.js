/**
 * micronutrientRules — pure rules for the vitamin + mineral carousel cards.
 *
 * Three cards, six tiles each (5 for fat-soluble — last cell stays empty):
 *   Card 6 — Vitamins (Fat-Soluble + C):  A, C, D, E, K
 *   Card 7 — Vitamins (B-Complex):        B1, B2, B3, B6, B9, B12
 *   Card 8 — Minerals (Essential):        Calcium, Iron, Magnesium,
 *                                         Potassium, Zinc, Phosphorus
 *
 * RDA values are standard adult guidelines (US/DV). They are static — when
 * personalization by sex / age / weight is needed, replace the constant with
 * a computeXxxTarget({ user }) helper, the same way computeMacroTargets does
 * for protein/fat/carbs. Keeping them flat for now matches the rest of the
 * carousel (sodium/cholesterol/sugar/fiber are also flat constants).
 *
 * Domain layer per claude.md §3.1 — pure, no I/O.
 */

// ─── RDA constants ────────────────────────────────────────────────────────────
// Tuple shape: { key, label, unit, target }
//   key    — matches the corresponding `Total<Name>` DB column / dailyStats
//            field (without the "Total" prefix and camelCased).
//   label  — short display name on the tile.
//   unit   — display unit; AI returns the value in this unit.
//   target — adult RDA / DV (used as the progress-bar denominator).

export const FAT_SOLUBLE_VITAMINS = [
  { key: 'totalVitaminA', label: 'Vit A',  unit: 'µg', target: 900 },
  { key: 'totalVitaminC', label: 'Vit C',  unit: 'mg', target: 90  },
  { key: 'totalVitaminD', label: 'Vit D',  unit: 'µg', target: 20  },
  { key: 'totalVitaminE', label: 'Vit E',  unit: 'mg', target: 15  },
  { key: 'totalVitaminK', label: 'Vit K',  unit: 'µg', target: 120 },
];

export const B_COMPLEX_VITAMINS = [
  { key: 'totalVitaminB1',  label: 'B1',  unit: 'mg', target: 1.2 },
  { key: 'totalVitaminB2',  label: 'B2',  unit: 'mg', target: 1.3 },
  { key: 'totalVitaminB3',  label: 'B3',  unit: 'mg', target: 16  },
  { key: 'totalVitaminB6',  label: 'B6',  unit: 'mg', target: 1.7 },
  { key: 'totalVitaminB9',  label: 'B9',  unit: 'µg', target: 400 },
  { key: 'totalVitaminB12', label: 'B12', unit: 'µg', target: 2.4 },
];

export const ESSENTIAL_MINERALS = [
  { key: 'totalCalcium',    label: 'Calcium',  unit: 'mg', target: 1000 },
  { key: 'totalIron',       label: 'Iron',     unit: 'mg', target: 18   },
  { key: 'totalMagnesium',  label: 'Magn.',    unit: 'mg', target: 420  },
  { key: 'totalPotassium',  label: 'Potass.',  unit: 'mg', target: 3500 },
  { key: 'totalZinc',       label: 'Zinc',     unit: 'mg', target: 11   },
  { key: 'totalPhosphorus', label: 'Phos.',    unit: 'mg', target: 700  },
];

// Flat list (export aliases) — useful for the backend extractor mirror, tests,
// and the Gemini prompt builder when it lists required keys.
export const ALL_MICRONUTRIENTS = [
  ...FAT_SOLUBLE_VITAMINS,
  ...B_COMPLEX_VITAMINS,
  ...ESSENTIAL_MINERALS,
];

// ─── pure compute helpers ─────────────────────────────────────────────────────

/**
 * Round to 1 decimal for sub-unit values (mg of B1, µg of B12) and to whole
 * numbers for larger targets. Keeps the UI compact.
 */
function formatConsumed(value, target) {
  const n = Number(value) || 0;
  if (target < 10) return Math.round(n * 10) / 10;
  return Math.round(n);
}

/**
 * Build a tile descriptor for a single micronutrient.
 *
 * @param {{ key:string, label:string, unit:string, target:number }} spec
 * @param {Record<string, number|null|undefined>} dailyStats
 * @returns {{ key:string, label:string, unit:string, target:number,
 *             consumed:number, pct:number }}
 */
export function computeMicronutrientTile(spec, dailyStats) {
  const raw = dailyStats?.[spec.key];
  const consumed = formatConsumed(raw, spec.target);
  const pct = spec.target > 0
    ? Math.min(100, Math.round((consumed / spec.target) * 100))
    : 0;
  return { ...spec, consumed, pct };
}

export function computeVitaminsFatSolubleCard(dailyStats) {
  return FAT_SOLUBLE_VITAMINS.map((s) => computeMicronutrientTile(s, dailyStats));
}

export function computeVitaminsBComplexCard(dailyStats) {
  return B_COMPLEX_VITAMINS.map((s) => computeMicronutrientTile(s, dailyStats));
}

export function computeMineralsCard(dailyStats) {
  return ESSENTIAL_MINERALS.map((s) => computeMicronutrientTile(s, dailyStats));
}
