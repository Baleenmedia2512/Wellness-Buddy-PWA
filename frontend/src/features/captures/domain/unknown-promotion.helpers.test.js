/**
 * Run: node --test frontend/src/features/captures/domain/unknown-promotion.helpers.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasRecognizedFood } from './unknown-promotion.helpers.js';

describe('hasRecognizedFood', () => {
  it('accepts foods with positive calories', () => {
    assert.equal(
      hasRecognizedFood({
        foods: [{ name: 'Idli', nutrition: { calories: 120 } }],
        total: { calories: 120 },
      }),
      true,
    );
  });

  it('accepts zero-calorie liquid with volume (plain water)', () => {
    assert.equal(
      hasRecognizedFood({
        foods: [{
          name: 'Plain Water',
          isLiquid: true,
          volume_ml: 1000,
          nutrition: { calories: 0 },
        }],
        total: { calories: 0 },
      }),
      true,
    );
  });

  it('rejects zero-calorie solid / unnamed hallucination', () => {
    assert.equal(
      hasRecognizedFood({
        foods: [{ name: 'Unknown Food', nutrition: { calories: 0 } }],
        total: { calories: 0 },
      }),
      false,
    );
  });

  it('rejects empty foods list', () => {
    assert.equal(hasRecognizedFood({ foods: [], total: { calories: 0 } }), false);
  });
});
