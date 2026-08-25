/**
 * Run: node --test frontend/src/features/wellness-score-sheet/domain/__tests__/parameterIcons.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getScoringModeHint } from '../parameterIcons.js';

describe('getScoringModeHint', () => {
  it('good habit post is any time today, not a window', () => {
    const hint = getScoringModeHint('binary', 'good_habit_post');
    assert.match(hint, /any time today/i);
    assert.equal(/between/i.test(hint), false);
  });
});
