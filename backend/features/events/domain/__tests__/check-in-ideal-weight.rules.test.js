import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCheckInIdealWeightProgress } from '../check-in-ideal-weight.rules.js';

describe('buildCheckInIdealWeightProgress', () => {
  // Height 170 cm → idealMin ≈ 54.91, idealMax ≈ 66.47
  it('shows remaining kg when above ideal', () => {
    const progress = buildCheckInIdealWeightProgress({
      heightCm: 170,
      currentWeightKg: 80,
    });
    assert.equal(progress.status, 'above');
    assert.ok(progress.remainingKg > 0);
    assert.match(progress.label, /kg left to Ideal Weight/i);
  });

  it('shows remaining kg when below ideal', () => {
    const progress = buildCheckInIdealWeightProgress({
      heightCm: 170,
      currentWeightKg: 48,
    });
    assert.equal(progress.status, 'below');
    assert.ok(progress.remainingKg > 0);
    assert.match(progress.label, /kg left to Ideal Weight/i);
  });

  it('marks reached when inside ideal band', () => {
    const progress = buildCheckInIdealWeightProgress({
      heightCm: 170,
      currentWeightKg: 60,
    });
    assert.equal(progress.status, 'reached');
    assert.equal(progress.remainingKg, 0);
    assert.match(progress.label, /Ideal Weight reached/i);
  });

  it('returns null without height or weight', () => {
    assert.equal(buildCheckInIdealWeightProgress({ heightCm: 170 }), null);
    assert.equal(buildCheckInIdealWeightProgress({ currentWeightKg: 70 }), null);
  });
});
