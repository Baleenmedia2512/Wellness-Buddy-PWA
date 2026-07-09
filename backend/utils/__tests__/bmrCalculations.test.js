/**
 * Unit tests for Katch-McArdle BMR calculations.
 * Run: node --test backend/utils/__tests__/bmrCalculations.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLeanBodyMass,
  computeKatchMcArdleBmr,
  resolveBmrFromBodyMetrics,
  resolveBmrForSave,
  isValidWeightKg,
  isValidBodyFatPercent,
} from '../bmrCalculations.js';

describe('computeLeanBodyMass', () => {
  it('computes LBM from weight and body fat %', () => {
    // 80 kg @ 20% fat → LBM = 64 kg
    assert.equal(computeLeanBodyMass(80, 20), 64);
  });

  it('returns null for missing or invalid inputs', () => {
    assert.equal(computeLeanBodyMass(null, 20), null);
    assert.equal(computeLeanBodyMass(80, null), null);
    assert.equal(computeLeanBodyMass(10, 20), null); // below min weight
    assert.equal(computeLeanBodyMass(80, 0), null);  // below min body fat
    assert.equal(computeLeanBodyMass(80, 80), null); // above max body fat
  });
});

describe('computeKatchMcArdleBmr', () => {
  it('applies BMR = 370 + (21.6 × LBM)', () => {
    // 80 kg @ 20% → LBM 64 → BMR = 370 + 1382.4 = 1752
    assert.equal(computeKatchMcArdleBmr(80, 20), 1752);
  });

  it('returns null when inputs are invalid', () => {
    assert.equal(computeKatchMcArdleBmr(80, null), null);
    assert.equal(computeKatchMcArdleBmr(null, 20), null);
  });
});

describe('resolveBmrFromBodyMetrics', () => {
  it('prefers calculated BMR over fallback', () => {
    assert.equal(
      resolveBmrFromBodyMetrics({ weightKg: 80, bodyFatPercent: 20, fallbackBmr: 1500 }),
      1752,
    );
  });

  it('uses fallback when calculation is not possible', () => {
    assert.equal(
      resolveBmrFromBodyMetrics({ weightKg: 80, bodyFatPercent: null, fallbackBmr: 1500 }),
      1500,
    );
    assert.equal(
      resolveBmrFromBodyMetrics({ weightKg: 80, bodyFatPercent: null, fallbackBmr: null }),
      null,
    );
  });
});

describe('resolveBmrForSave', () => {
  it('prefers manual BMR when provided', () => {
    assert.equal(
      resolveBmrForSave({ weightKg: 80, bodyFatPercent: 20, manualBmr: 1500 }),
      1500,
    );
  });

  it('calculates when manual BMR is absent', () => {
    assert.equal(
      resolveBmrForSave({ weightKg: 80, bodyFatPercent: 20, manualBmr: null }),
      1752,
    );
  });
});

describe('resolveCardBmr', () => {
  it('recalculates from weight + fat when not manually overridden', async () => {
    const { resolveCardBmr } = await import('../../features/body-parameters-card/domain/card.rules.js');
    assert.equal(
      resolveCardBmr({ weightKg: 80, fatPercent: 33, manualBmr: 1752, preferManual: false }),
      1528,
    );
  });

  it('keeps manual BMR when preferManual is true', async () => {
    const { resolveCardBmr } = await import('../../features/body-parameters-card/domain/card.rules.js');
    assert.equal(
      resolveCardBmr({ weightKg: 80, fatPercent: 33, manualBmr: 1500, preferManual: true }),
      1500,
    );
  });
});

describe('validators', () => {
  it('validates weight and body fat ranges', () => {
    assert.equal(isValidWeightKg(70), true);
    assert.equal(isValidWeightKg(19), false);
    assert.equal(isValidBodyFatPercent(15), true);
    assert.equal(isValidBodyFatPercent(0.5), false);
  });
});
