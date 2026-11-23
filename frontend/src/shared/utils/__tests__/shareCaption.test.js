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
      composeQuickShareCaption(BRAND, 'Calories Burnt: 120 kcal so far today'),
      `${BRAND}, Calories Burnt: 120 kcal so far today`,
    );
  });

  it('puts WhatsApp-bold water consumed on the next line', () => {
    assert.equal(
      composeQuickShareCaption(BRAND, '*Consumed: 1.7 L* water so far today'),
      `${BRAND}\n*Consumed: 1.7 L* water so far today`,
    );
  });

  it('puts multi-line food suffixes under the brand with a blank line', () => {
    assert.equal(
      composeQuickShareCaption(BRAND, FOOD_SUFFIX),
      `${BRAND}\n\n${FOOD_SUFFIX}`,
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
      `${BRAND}\n\n${FOOD_SUFFIX}\n\n_Tomorrow is Marathon Day 4 - Detox Day_`,
    );
  });

  it('formats weight post with Day progress and Lap progress with blank line separation', () => {
    const weightSuffix = '*Day progress*\nPrev: 61 kg\nCurr: 61 kg';
    const caption = composeQuickShareCaption('System · Wellness Valley v 3.5.2', weightSuffix);
    const progress = {
      mode: 'running',
      currentDay: {
        displayLine: 'Day 0 : 60.50 kg → Curr: 61.00 kg ⬆️ 0.50 kg',
      },
    };
    const result = appendMarathonWhatsAppNotice(
      caption,
      '2026-08-09',
      progress,
      { includeWeightComparison: true },
    );
    assert.equal(
      result,
      'System · Wellness Valley v 3.5.2\n\n*Day progress*\nPrev: 61 kg\nCurr: 61 kg\n\n*Lap progress*\nDay 0 : 60.50 kg → Curr: 61.00 kg ⬆️ 0.50 kg\n_Tomorrow is Marathon Day 9 - Detox Day_',
    );
  });

  it('formats weight post on Marathon Day 0 with Today Marathon notice', () => {
    const weightSuffix = '*Day progress*\nPrev: 61 kg\nCurr: 61 kg';
    const caption = composeQuickShareCaption('System · Wellness Valley v 3.5.2', weightSuffix);
    const progress = {
      mode: 'running',
      previousMarathonEndWeight: 62,
      currentWeight: 61,
    };
    const result = appendMarathonWhatsAppNotice(
      caption,
      '2026-09-01',
      progress,
      { includeWeightComparison: true },
    );
    assert.equal(
      result,
      'System · Wellness Valley v 3.5.2\n\n*Day progress*\nPrev: 61 kg\nCurr: 61 kg\n\n*Lap progress*\nPrevious Marathon End weight : 62.00 kg\nCurrent Weight : 61.00 kg ⬇️\n_Marathon Day 0 - Today Marathon_',
    );
  });

  it('appends Overall below marathon notice when initial weight is present', () => {
    const weightSuffix = '*Day progress*\nPrev: 73 kg\nCurr: 75 kg ⬆️ 2 kg';
    const caption = composeQuickShareCaption('System · Wellness Valley v 3.5.7', weightSuffix);
    const progress = {
      mode: 'running',
      currentDay: {
        displayLine: 'Day 0 : 73.00 kg → Curr: 75.00 kg ⬆️ 2.00 kg',
      },
      currentWeight: 75,
    };
    const result = appendMarathonWhatsAppNotice(
      caption,
      '2026-08-04',
      progress,
      {
        includeWeightComparison: true,
        initialWeight: 70,
        currentWeight: 75,
      },
    );
    assert.equal(
      result,
      [
        'System · Wellness Valley v 3.5.7',
        '',
        '*Day progress*',
        'Prev: 73 kg',
        'Curr: 75 kg ⬆️ 2 kg',
        '',
        '*Lap progress*',
        'Day 0 : 73.00 kg → Curr: 75.00 kg ⬆️ 2.00 kg',
        '_Tomorrow is Marathon Day 4 - Detox Day_',
        '*Overall*',
        'Initial : 70.00 kg → Curr: 75.00 kg ⬆️ 5.00 kg',
      ].join('\n'),
    );
  });
  it('end-to-end: Lap progress then Marathon day then Overall', () => {
    const brand = 'ALLAN · Wellness Valley v 3.5.2';
    const weightSuffix = '*Day progress*\nIdeal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg';
    const composed = composeQuickShareCaption(brand, weightSuffix);

    const progress = {
      mode: 'running',
      marathonNumber: 1,
      marathonDay: 5,
      currentDay: { day: 5, displayLine: 'Day 0 : — → Curr: 80.00 kg' },
      currentWeight: 80,
    };

    const finalCaption = appendMarathonWhatsAppNotice(
      composed,
      '2026-08-06',
      progress,
      {
        includeWeightComparison: true,
        initialWeight: 85,
        currentWeight: 80,
      },
    );

    const expected = [
      'ALLAN · Wellness Valley v 3.5.2',
      '',
      '*Day progress*',
      'Ideal: 79.57 kg',
      'Prev: 80 kg',
      'Curr: 80 kg',
      '',
      '*Lap progress*',
      'Day 0 : — → Curr: 80.00 kg',
      '_Marathon Day 5_',
      '*Overall*',
      'Initial : 85.00 kg → Curr: 80.00 kg ⬇️ 5.00 kg',
    ].join('\n');

    assert.equal(finalCaption, expected);
  });

});
