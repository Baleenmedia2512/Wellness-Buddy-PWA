/**
 * Run: node --test frontend/src/features/nutrition/domain/herbalifeShakeRepost.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HERBALIFE_SHAKE_REPOST_WINDOW_MS,
  isHerbalifeShakeAnalysis,
  isWithinHerbalifeShakeRepostWindow,
  latestHerbalifeShakeWithinWindow,
  mealRowIsHerbalifeShake,
} from './herbalifeShakeRepost.rules.js';

const NOW = new Date('2026-10-03T12:00:00.000Z');

describe('isHerbalifeShakeAnalysis', () => {
  it('matches the shake calculator and the Herbalife Shake name', () => {
    assert.equal(isHerbalifeShakeAnalysis({ processedBy: 'shake_calculator' }), true);
    assert.equal(
      isHerbalifeShakeAnalysis({ foods: [{ name: 'Herbalife Shake' }] }),
      true,
    );
    assert.equal(
      isHerbalifeShakeAnalysis({ detailedItems: [{ name: 'Rice' }] }),
      false,
    );
  });
});

describe('isWithinHerbalifeShakeRepostWindow', () => {
  it('is true inside one hour and false after', () => {
    const inside = new Date(NOW.getTime() - 59 * 60 * 1000);
    const edge = new Date(NOW.getTime() - HERBALIFE_SHAKE_REPOST_WINDOW_MS);
    const older = new Date(NOW.getTime() - HERBALIFE_SHAKE_REPOST_WINDOW_MS - 1);
    assert.equal(isWithinHerbalifeShakeRepostWindow(inside, NOW), true);
    assert.equal(isWithinHerbalifeShakeRepostWindow(edge, NOW), true);
    assert.equal(isWithinHerbalifeShakeRepostWindow(older, NOW), false);
  });
});

describe('latestHerbalifeShakeWithinWindow', () => {
  it('returns the newest Herbalife Shake still inside the hour', () => {
    const recent = new Date(NOW.getTime() - 10 * 60 * 1000).toISOString();
    const older = new Date(NOW.getTime() - 40 * 60 * 1000).toISOString();
    const stale = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const found = latestHerbalifeShakeWithinWindow([
      { ID: 1, CreatedAt: stale, AnalysisData: { foods: [{ name: 'Herbalife Shake' }] } },
      { ID: 2, CreatedAt: older, ProcessedBy: 'shake_calculator', AnalysisData: { foods: [] } },
      { ID: 3, CreatedAt: recent, AnalysisData: JSON.stringify({ foods: [{ name: 'Herbalife Shake' }] }) },
      { ID: 4, CreatedAt: recent, AnalysisData: { foods: [{ name: 'Idli' }] } },
    ], NOW);
    assert.equal(found.id, 3);
  });

  it('returns null when the only shake is older than one hour', () => {
    const stale = new Date(NOW.getTime() - 90 * 60 * 1000).toISOString();
    assert.equal(
      latestHerbalifeShakeWithinWindow([
        { ID: 9, CreatedAt: stale, AnalysisData: { foods: [{ name: 'Herbalife Shake' }] } },
      ], NOW),
      null,
    );
  });
});

describe('mealRowIsHerbalifeShake', () => {
  it('ignores other foods', () => {
    assert.equal(
      mealRowIsHerbalifeShake({ AnalysisData: { foods: [{ name: 'Afresh' }] } }),
      false,
    );
  });
});
