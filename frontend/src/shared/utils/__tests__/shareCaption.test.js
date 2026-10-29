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
      `${BRAND}, 1890 kcal\nMasala Dosa - GI 65 m\nRagi Dosa - GI 45 l\nPlain Ghee Dosa - GI 72 h\n_Tomorrow is Marathon Day 4 - Detox Day_`,
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
      'System · Wellness Valley v 3.5.2\n\n*Day progress*\nPrev: 61 kg\nCurr: 61 kg\n\n_Tomorrow is Marathon Day 9 - Detox Day_\n*Lap progress*\nDay 0 : 60.50 kg → Curr: 61.00 kg ⬆️ 0.50 kg',
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
      'System · Wellness Valley v 3.5.2\n\n*Day progress*\nPrev: 61 kg\nCurr: 61 kg\n\n_Marathon Day 0 - Today Marathon_\n*Lap progress*\nPrevious Marathon End weight : 62.00 kg\nCurrent Weight : 61.00 kg ⬇️',
    );
  });
  it('formats transformation caption with DAY PROGRESS and LAP PROGRESS headings (Step 5 required test)', () => {
    const brand = 'ALLAN · Wellness Valley v 3.5.2';
    const suffix = [
      'Ideal: 79.57 kg',
      'Prev: 80 kg',
      'Curr: 80 kg',
      'Marathon Day 5',
      'Day 0 : — → Curr: 80.00 kg',
    ].join('\n');

    const expected = [
      'ALLAN · Wellness Valley v 3.5.2',
      '',
      'DAY PROGRESS',
      '',
      'Ideal: 79.57 kg',
      'Prev: 80 kg',
      'Curr: 80 kg',
      '',
      'LAP PROGRESS',
      '',
      'Marathon Day 5',
      'Day 0 : — → Curr: 80.00 kg',
    ].join('\n');

    assert.equal(composeQuickShareCaption(brand, suffix), expected);
  });

  it('end-to-end integration: produces DAY PROGRESS and LAP PROGRESS when marathon notice appends to weight caption', () => {
    const brand = 'ALLAN · Wellness Valley v 3.5.2';
    const weightSuffix = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg';
    // Step 1: App.js calls composeQuickShareCaption(brand, activityCaption)
    const composed = composeQuickShareCaption(brand, weightSuffix);

    // Step 2: withMarathonWhatsAppNotice calls appendMarathonWhatsAppNotice with weight comparison
    const progress = {
      mode: 'running',
      marathonNumber: 1,
      marathonDay: 5,
      currentDay: { day: 5, displayLine: 'Day 0 : — → Curr: 80.00 kg' },
    };

    // Date inside marathon: 2026-08-05 (Marathon Day 5)
    const finalCaption = appendMarathonWhatsAppNotice(
      composed,
      '2026-08-06',
      progress,
      { includeWeightComparison: true },
    );

    const expected = [
      'ALLAN · Wellness Valley v 3.5.2',
      '',
      'DAY PROGRESS',
      '',
      'Ideal: 79.57 kg',
      'Prev: 80 kg',
      'Curr: 80 kg',
      '',
      'LAP PROGRESS',
      '',
      'Marathon Day 5',
      'Day 0 : — → Curr: 80.00 kg',
    ].join('\n');

    assert.equal(finalCaption, expected);
  });

});
