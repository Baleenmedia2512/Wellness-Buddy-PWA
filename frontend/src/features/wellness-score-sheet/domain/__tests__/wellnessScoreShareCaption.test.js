/**
 * Run: node --test frontend/src/features/wellness-score-sheet/domain/__tests__/wellnessScoreShareCaption.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatWellnessScoreWhatsAppNoticeLines } from '../wellnessScoreShareCaption.js';

describe('formatWellnessScoreWhatsAppNoticeLines', () => {
  it('formats earned / possible', () => {
    assert.deepEqual(
      formatWellnessScoreWhatsAppNoticeLines(450.4, 900),
      ['*Wellness Score*', '450 / 900'],
    );
  });

  it('returns empty when totals are missing or invalid', () => {
    assert.deepEqual(formatWellnessScoreWhatsAppNoticeLines(null, 900), []);
    assert.deepEqual(formatWellnessScoreWhatsAppNoticeLines(450, 0), []);
    assert.deepEqual(formatWellnessScoreWhatsAppNoticeLines('x', 900), []);
  });
});
