/**
 * micronutrientRules.test.js — domain-layer unit tests for the new
 * vitamin + mineral card compute helpers.
 *
 * Per claude.md §9.1, domain code must hold ≥ 95% line / 90% branch coverage.
 */
import {
  FAT_SOLUBLE_VITAMINS,
  B_COMPLEX_VITAMINS,
  ESSENTIAL_MINERALS,
  ALL_MICRONUTRIENTS,
  computeMicronutrientTile,
  computeVitaminsFatSolubleCard,
  computeVitaminsBComplexCard,
  computeMineralsCard,
} from '../domain/micronutrientRules';

describe('micronutrientRules — spec lists', () => {
  it('exposes 5 fat-soluble + C vitamins, 6 B vitamins, and 6 minerals', () => {
    expect(FAT_SOLUBLE_VITAMINS).toHaveLength(5);
    expect(B_COMPLEX_VITAMINS).toHaveLength(6);
    expect(ESSENTIAL_MINERALS).toHaveLength(6);
    expect(ALL_MICRONUTRIENTS).toHaveLength(17);
  });

  it('every spec carries key, label, unit, and positive target', () => {
    for (const spec of ALL_MICRONUTRIENTS) {
      expect(typeof spec.key).toBe('string');
      expect(spec.key.startsWith('total')).toBe(true);
      expect(typeof spec.label).toBe('string');
      expect(['mg', 'µg']).toContain(spec.unit);
      expect(spec.target).toBeGreaterThan(0);
    }
  });

  it('has no duplicate keys', () => {
    const keys = ALL_MICRONUTRIENTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('computeMicronutrientTile', () => {
  const vitC = { key: 'totalVitaminC', label: 'Vit C', unit: 'mg', target: 90 };

  it('computes consumed + pct from dailyStats', () => {
    const tile = computeMicronutrientTile(vitC, { totalVitaminC: 45 });
    expect(tile.consumed).toBe(45);
    expect(tile.pct).toBe(50);
    expect(tile.label).toBe('Vit C');
    expect(tile.unit).toBe('mg');
    expect(tile.target).toBe(90);
  });

  it('caps pct at 100 when consumed exceeds target', () => {
    const tile = computeMicronutrientTile(vitC, { totalVitaminC: 200 });
    expect(tile.pct).toBe(100);
    expect(tile.consumed).toBe(200);
  });

  it('returns 0 consumed + 0 pct when dailyStats is missing the key', () => {
    const tile = computeMicronutrientTile(vitC, {});
    expect(tile.consumed).toBe(0);
    expect(tile.pct).toBe(0);
  });

  it('handles null dailyStats safely', () => {
    const tile = computeMicronutrientTile(vitC, null);
    expect(tile.consumed).toBe(0);
    expect(tile.pct).toBe(0);
  });

  it('rounds to 1 decimal for sub-unit targets (e.g. B1 at 1.2 mg)', () => {
    const b1 = { key: 'totalVitaminB1', label: 'B1', unit: 'mg', target: 1.2 };
    const tile = computeMicronutrientTile(b1, { totalVitaminB1: 0.83 });
    expect(tile.consumed).toBe(0.8);
    expect(tile.pct).toBe(67);
  });

  it('rounds to whole numbers for large targets (e.g. Potassium at 3500 mg)', () => {
    const k = { key: 'totalPotassium', label: 'K', unit: 'mg', target: 3500 };
    const tile = computeMicronutrientTile(k, { totalPotassium: 1234.67 });
    expect(tile.consumed).toBe(1235);
  });

  it('treats non-numeric values as 0 instead of NaN', () => {
    const tile = computeMicronutrientTile(vitC, { totalVitaminC: 'oops' });
    expect(tile.consumed).toBe(0);
    expect(tile.pct).toBe(0);
  });
});

describe('compute*Card builders', () => {
  const stats = {
    totalVitaminA: 450, totalVitaminC: 90, totalVitaminD: 5, totalVitaminE: 30, totalVitaminK: 60,
    totalVitaminB1: 0.6, totalVitaminB2: 1.3, totalVitaminB3: 8, totalVitaminB6: 0.85,
    totalVitaminB9: 800, totalVitaminB12: 0,
    totalCalcium: 1000, totalIron: 9, totalMagnesium: 210, totalPotassium: 1750,
    totalZinc: 22, totalPhosphorus: 350,
  };

  it('Vitamins A-K card returns 5 tiles, correctly ordered', () => {
    const tiles = computeVitaminsFatSolubleCard(stats);
    expect(tiles).toHaveLength(5);
    expect(tiles.map((t) => t.label)).toEqual(['Vit A', 'Vit C', 'Vit D', 'Vit E', 'Vit K']);
    // Vit C = 90/90 = 100%
    expect(tiles.find((t) => t.label === 'Vit C').pct).toBe(100);
    // Vit D = 5/20 = 25%
    expect(tiles.find((t) => t.label === 'Vit D').pct).toBe(25);
    // Vit E = 30/15 → capped at 100%
    expect(tiles.find((t) => t.label === 'Vit E').pct).toBe(100);
  });

  it('B Vitamins card returns 6 tiles', () => {
    const tiles = computeVitaminsBComplexCard(stats);
    expect(tiles).toHaveLength(6);
    expect(tiles.map((t) => t.label)).toEqual(['B1', 'B2', 'B3', 'B6', 'B9', 'B12']);
    // B12 with 0 consumed → 0%
    expect(tiles.find((t) => t.label === 'B12').pct).toBe(0);
    // B9 = 800/400 → 100%
    expect(tiles.find((t) => t.label === 'B9').pct).toBe(100);
  });

  it('Minerals card returns 6 tiles', () => {
    const tiles = computeMineralsCard(stats);
    expect(tiles).toHaveLength(6);
    expect(tiles.map((t) => t.label)).toEqual(['Calcium', 'Iron', 'Magn.', 'Potass.', 'Zinc', 'Phos.']);
    expect(tiles.find((t) => t.label === 'Calcium').pct).toBe(100);
    // Iron = 9/18 = 50%
    expect(tiles.find((t) => t.label === 'Iron').pct).toBe(50);
    // Zinc = 22/11 → capped at 100%
    expect(tiles.find((t) => t.label === 'Zinc').pct).toBe(100);
  });

  it('returns all-zero tiles when dailyStats is empty', () => {
    const tiles = computeMineralsCard({});
    expect(tiles.every((t) => t.consumed === 0 && t.pct === 0)).toBe(true);
  });
});
