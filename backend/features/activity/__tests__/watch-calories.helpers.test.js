/**
 * Run: node --test backend/features/activity/__tests__/watch-calories.helpers.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maxWatchCaloriesFromRows, parseWatchKcalFromTopic } from '../domain/watch-calories.helpers.js';

describe('parseWatchKcalFromTopic', () => {
  it('parses standard topic', () => {
    assert.equal(parseWatchKcalFromTopic('Calories Burned: 300 kcal'), 300);
  });

  it('returns 0 for non-matching topic', () => {
    assert.equal(parseWatchKcalFromTopic('Education Meeting'), 0);
  });
});

describe('maxWatchCaloriesFromRows', () => {
  it('returns highest kcal when multiple uploads same day', () => {
    const rows = [
      { Topic: 'Calories Burned: 150 kcal' },
      { Topic: 'Calories Burned: 300 kcal' },
    ];
    assert.equal(maxWatchCaloriesFromRows(rows), 300);
  });

  it('returns 0 for empty rows', () => {
    assert.equal(maxWatchCaloriesFromRows([]), 0);
  });
});
