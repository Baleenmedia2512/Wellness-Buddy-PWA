/**
 * Dry-salad suggestion section titles.
 * Run: node --test frontend/src/features/nutrition/domain/drySaladSuggestionTitles.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  drySaladUsualComboTitle,
  drySaladOftenTitle,
  drySaladSlotFromDeviceNow,
} from './foodSuggestionRank.js';

describe('dry salad suggestion titles', () => {
  it('names the usual combo by slot', () => {
    assert.equal(drySaladUsualComboTitle('morning'), 'Your usual morning combo');
    assert.equal(drySaladUsualComboTitle('afternoon'), 'Your usual afternoon combo');
    assert.equal(drySaladUsualComboTitle('night'), 'Your usual night combo');
    assert.equal(drySaladUsualComboTitle(null), 'Your usual combo');
  });

  it('maps device clock hour to the same slot bands', () => {
    assert.equal(drySaladSlotFromDeviceNow(new Date(2026, 7, 23, 18, 46)), 'evening');
    assert.equal(drySaladSlotFromDeviceNow(new Date(2026, 7, 23, 13, 10)), 'afternoon');
    assert.equal(drySaladSlotFromDeviceNow(new Date(2026, 7, 23, 7, 5)), 'morning');
  });

  it('names often-at-this-time by slot', () => {
    assert.equal(drySaladOftenTitle('evening'), 'Often at this evening');
    assert.equal(drySaladOftenTitle(null), 'Often at this time');
  });
});
