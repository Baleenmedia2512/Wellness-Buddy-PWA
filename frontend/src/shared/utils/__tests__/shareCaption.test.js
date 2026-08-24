/**
 * Run: node --test frontend/src/shared/utils/__tests__/shareCaption.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeQuickShareCaption } from '../shareCaption.js';
import { appendMarathonWhatsAppNotice } from '../../../features/marathon/domain/marathonShareCaption.js';

const BRAND = 'YASHEER J \u00B7 Wellness Valley v 3.4.6';
const FOOD_SUFFIX = '1890 kcal\nMasala Dosa - GI 65 m\nRagi Dosa - GI 45 l\nPlain Ghee Dosa - GI 72 h';

describe('composeQuickShareCaption', () => {
  it('joins a one-line suffix with a comma', () => {
    assert.equal(
      composeQuickShareCaption(BRAND, 'Consumed: 1 L water so far today'),
      `${BRAND}, Consumed: 1 L water so far today`,
    );
  });

  it('puts food kcal on the brand line and each item on its own line', () => {
    assert.equal(
      composeQuickShareCaption(BRAND, FOOD_SUFFIX),
      `${BRAND}, 1890 kcal\nMasala Dosa - GI 65 m\nRagi Dosa - GI 45 l\nPlain Ghee Dosa - GI 72 h`,
    );
  });

  it('keeps a blank line before weight suffixes', () => {
    assert.equal(
      composeQuickShareCaption(BRAND, 'Ideal: 73.7 kg\nPrev: 72.9 kg\nCurr: 72.85 kg ⬇️'),
      `${BRAND}\n\nIdeal: 73.7 kg\nPrev: 72.9 kg\nCurr: 72.85 kg ⬇️`,
    );
  });

  it('appends the detox-day notice on the last line of a food caption', () => {
    const caption = composeQuickShareCaption(BRAND, FOOD_SUFFIX);
    assert.equal(
      appendMarathonWhatsAppNotice(caption, '2026-08-04'),
      `${BRAND}, 1890 kcal\nMasala Dosa - GI 65 m\nRagi Dosa - GI 45 l\nPlain Ghee Dosa - GI 72 h\nTomorrow is Day 4 - Detox Day`,
    );
  });
});
