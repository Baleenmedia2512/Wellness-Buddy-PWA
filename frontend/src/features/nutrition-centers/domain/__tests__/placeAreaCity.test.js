/**
 * Run: node --test frontend/src/features/nutrition-centers/domain/__tests__/placeAreaCity.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { areaCityFromComponents, formatAreaCity } from '../placeAreaCity.js';

describe('areaCityFromComponents', () => {
  it('reads neighbourhood and city', () => {
    assert.deepEqual(areaCityFromComponents([
      { long_name: 'Adyar', types: ['sublocality_level_1', 'sublocality', 'political'] },
      { long_name: 'Chennai', types: ['locality', 'political'] },
      { long_name: 'Tamil Nadu', types: ['administrative_area_level_1', 'political'] },
    ]), { area: 'Adyar', city: 'Chennai' });
  });

  it('joins area and city for the card', () => {
    assert.equal(formatAreaCity('Adyar', 'Chennai'), 'Adyar, Chennai');
    assert.equal(formatAreaCity('', 'Chennai'), 'Chennai');
    assert.equal(formatAreaCity('', ''), '');
  });
});
