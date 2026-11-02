/**
 * Run: node --test backend/features/background-analysis/__tests__/nutrition-source.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NUTRITION_SOURCE,
  resolveNutritionSource,
} from '../domain/nutrition-source.js';

describe('resolveNutritionSource', () => {
  it('uses explicit source ai from new clients', () => {
    assert.equal(
      resolveNutritionSource({ source: 'ai', processedBy: 'manual_app' }, 'manual_app'),
      NUTRITION_SOURCE.AI,
    );
  });

  it('uses explicit source manual from new clients', () => {
    assert.equal(
      resolveNutritionSource({ source: 'manual' }, 'manual_app'),
      NUTRITION_SOURCE.MANUAL,
    );
  });

  it('normalizes UI labels AI Analysis and Manual Entry', () => {
    assert.equal(resolveNutritionSource({ source: 'AI Analysis' }), NUTRITION_SOURCE.AI);
    assert.equal(resolveNutritionSource({ source: 'Manual Entry' }), NUTRITION_SOURCE.MANUAL);
  });

  it('treats isManualEntry as manual when source is missing', () => {
    assert.equal(
      resolveNutritionSource({ isManualEntry: true }, 'manual_app'),
      NUTRITION_SOURCE.MANUAL,
    );
  });

  it('infers manual from water / afresh / shake presets', () => {
    assert.equal(
      resolveNutritionSource({ processedBy: 'water_preset' }),
      NUTRITION_SOURCE.MANUAL,
    );
    assert.equal(
      resolveNutritionSource({}, 'afresh_preset'),
      NUTRITION_SOURCE.MANUAL,
    );
    assert.equal(
      resolveNutritionSource({ processedBy: 'shake_calculator' }, 'manual_app'),
      NUTRITION_SOURCE.MANUAL,
    );
  });

  it('does not treat ProcessedBy manual_app as Manual Log', () => {
    assert.equal(
      resolveNutritionSource({ foods: [{ name: 'Rice' }] }, 'manual_app'),
      null,
    );
  });

  it('infers ai from Android background_service (Gemini on-device pipeline)', () => {
    assert.equal(
      resolveNutritionSource({ foods: [] }, 'background_service'),
      NUTRITION_SOURCE.AI,
    );
  });

  it('returns null when source is unknown so old rows stay unguessed', () => {
    assert.equal(resolveNutritionSource(null), null);
    assert.equal(resolveNutritionSource({}), null);
    assert.equal(resolveNutritionSource({ source: 'other' }), null);
  });

  it('prefers explicit source over processedBy preset', () => {
    assert.equal(
      resolveNutritionSource({ source: 'ai', processedBy: 'water_preset' }, 'water_preset'),
      NUTRITION_SOURCE.AI,
    );
  });
});
