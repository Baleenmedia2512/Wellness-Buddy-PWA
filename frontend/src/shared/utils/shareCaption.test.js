/**
 * Run: node --test frontend/src/shared/utils/shareCaption.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  composeQuickShareCaption,
  formatTransformationCaption,
  splitTransformationLines,
} from './shareCaption.js';

const BRAND = 'ALLAN \u00B7 Wellness Valley v 3.5.2';

describe('composeQuickShareCaption', () => {
  it('keeps WhatsApp-formatted suffixes on a new line under the brand', () => {
    assert.equal(
      composeQuickShareCaption(
        'Balaji Sekar · Wellness Valley v 3.4.5',
        '*Daily Education · Zoom*',
      ),
      'Balaji Sekar · Wellness Valley v 3.4.5\n*Daily Education · Zoom*',
    );
  });

  it('keeps weight-style multi-line captions separated by a blank line when not a marathon transformation', () => {
    assert.equal(
      composeQuickShareCaption(
        'Balaji Sekar · Wellness Valley v 3.4.5',
        'Ideal: 73.7 kg\nPrev: 73.4 kg\nCurr: 72.9 kg ⬇️',
      ),
      'Balaji Sekar · Wellness Valley v 3.4.5\n\nIdeal: 73.7 kg\nPrev: 73.4 kg\nCurr: 72.9 kg ⬇️',
    );
  });

  it('formats transformation caption with DAY PROGRESS and LAP PROGRESS headings (Step 5 required test)', () => {
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

    assert.equal(composeQuickShareCaption(BRAND, suffix), expected);
  });

  it('handles edge case 1: weight and marathon details in a multiline suffix', () => {
    const suffix = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg\nMarathon Day 5\nDay 0 : — → Curr: 80.00 kg';
    const result = composeQuickShareCaption(BRAND, suffix);

    assert.ok(result.includes('DAY PROGRESS'));
    assert.ok(result.includes('LAP PROGRESS'));
    assert.ok(result.indexOf('DAY PROGRESS') < result.indexOf('LAP PROGRESS'));
  });

  it('handles edge case 2: single string with spaces instead of line breaks', () => {
    const singleStringSuffix =
      'Ideal: 79.57 kg Prev: 80 kg Curr: 80 kg Marathon Day 5 Day 0 : — → Curr: 80.00 kg';

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

    assert.equal(composeQuickShareCaption(BRAND, singleStringSuffix), expected);
  });

  it('handles edge case 3: marathon progress containing additional daily progress lines', () => {
    const suffix = [
      'Ideal: 79.57 kg',
      'Prev: 80 kg',
      'Curr: 80 kg',
      'Marathon Day 5',
      'Day 0 : — → Curr: 80.00 kg',
      'Day 1 : 81.00 kg → Curr: 80.00 kg ⬇️ 1.00 kg',
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
      'Day 1 : 81.00 kg → Curr: 80.00 kg ⬇️ 1.00 kg',
    ].join('\n');

    assert.equal(composeQuickShareCaption(BRAND, suffix), expected);
  });

  it('handles edge case 4: different marathon day numbers (e.g. Day 1, Day 10, Tomorrow is Marathon Day)', () => {
    const suffixDay1 = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg\nMarathon Day 1\nDay 0 : 80 kg → Curr: 80 kg';
    const resultDay1 = composeQuickShareCaption(BRAND, suffixDay1);
    assert.ok(resultDay1.includes('DAY PROGRESS\n\nIdeal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg'));
    assert.ok(resultDay1.includes('LAP PROGRESS\n\nMarathon Day 1\nDay 0 : 80 kg → Curr: 80 kg'));

    const suffixDay10 = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg\nMarathon Day 10\nDay 0 : 80 kg → Curr: 80 kg';
    const resultDay10 = composeQuickShareCaption(BRAND, suffixDay10);
    assert.ok(resultDay10.includes('LAP PROGRESS\n\nMarathon Day 10'));

    const suffixDetox = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg\nTomorrow is Marathon Day 4 - Detox Day\nDay 0 : 80 kg → Curr: 80 kg';
    const resultDetox = composeQuickShareCaption(BRAND, suffixDetox);
    assert.ok(resultDetox.includes('LAP PROGRESS\n\nTomorrow is Marathon Day 4 - Detox Day'));
  });

  it('handles edge case 5: current weight above, below, or equal to previous weight', () => {
    // Current equal to previous
    const equalSuffix = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg\nMarathon Day 5\nDay 0 : — → Curr: 80.00 kg';
    assert.ok(composeQuickShareCaption(BRAND, equalSuffix).includes('Curr: 80 kg'));

    // Current below previous (loss with arrow and delta)
    const belowSuffix = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 79.2 kg ⬇️ 0.8 kg\nMarathon Day 5\nDay 0 : — → Curr: 79.20 kg';
    assert.ok(composeQuickShareCaption(BRAND, belowSuffix).includes('Curr: 79.2 kg ⬇️ 0.8 kg'));

    // Current above previous (gain with arrow and delta)
    const aboveSuffix = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 80.5 kg ⬆️ 0.5 kg\nMarathon Day 5\nDay 0 : — → Curr: 80.50 kg';
    assert.ok(composeQuickShareCaption(BRAND, aboveSuffix).includes('Curr: 80.5 kg ⬆️ 0.5 kg'));
  });

  it('handles edge case 6: some transformation values are missing', () => {
    // Missing Prev (first log: only Ideal and Curr)
    const noPrev = 'Ideal: 79.57 kg\nCurr: 80 kg\nMarathon Day 5\nDay 0 : — → Curr: 80.00 kg';
    const resultNoPrev = composeQuickShareCaption(BRAND, noPrev);
    assert.ok(resultNoPrev.includes('DAY PROGRESS\n\nIdeal: 79.57 kg\nCurr: 80 kg'));
    assert.ok(resultNoPrev.includes('LAP PROGRESS\n\nMarathon Day 5'));

    // Missing Ideal (height not in profile: only Prev and Curr)
    const noIdeal = 'Prev: 80 kg\nCurr: 80 kg\nMarathon Day 5\nDay 0 : — → Curr: 80.00 kg';
    const resultNoIdeal = composeQuickShareCaption(BRAND, noIdeal);
    assert.ok(resultNoIdeal.includes('DAY PROGRESS\n\nPrev: 80 kg\nCurr: 80 kg'));
    assert.ok(resultNoIdeal.includes('LAP PROGRESS\n\nMarathon Day 5'));

    // Missing Day 0 comparison line (only Marathon Day)
    const noDay0 = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg\nMarathon Day 5';
    const resultNoDay0 = composeQuickShareCaption(BRAND, noDay0);
    assert.ok(resultNoDay0.includes('DAY PROGRESS\n\nIdeal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg'));
    assert.ok(resultNoDay0.includes('LAP PROGRESS\n\nMarathon Day 5'));

    // Only Curr present (missing both Ideal and Prev)
    const onlyCurr = 'Curr: 80 kg\nMarathon Day 5\nDay 0 : — → Curr: 80.00 kg';
    const resultOnlyCurr = composeQuickShareCaption(BRAND, onlyCurr);
    assert.ok(resultOnlyCurr.includes('DAY PROGRESS\n\nCurr: 80 kg'));
    assert.ok(resultOnlyCurr.includes('LAP PROGRESS\n\nMarathon Day 5'));
  });

  it('handles edge case 7: caption does not represent a transformation', () => {
    // Weight only (no marathon info)
    const weightOnly = 'Ideal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg';
    assert.equal(
      composeQuickShareCaption(BRAND, weightOnly),
      `${BRAND}\n\n${weightOnly}`,
    );

    // One-line activity
    assert.equal(
      composeQuickShareCaption(BRAND, 'Calories Burnt: 350 kcal so far today'),
      `${BRAND}, Calories Burnt: 350 kcal so far today`,
    );
  });

  it('handles edge case 8: food caption remains unchanged', () => {
    const foodSuffix = '1890 kcal\nMasala Dosa - GI 65 m\nRagi Dosa - GI 45 l';
    assert.equal(
      composeQuickShareCaption(BRAND, foodSuffix),
      `${BRAND}, 1890 kcal\nMasala Dosa - GI 65 m\nRagi Dosa - GI 45 l`,
    );
  });

  it('handles edge case 9: bold WhatsApp caption remains unchanged', () => {
    const boldSuffix = '*Consumed: 2.5 L* water so far today';
    assert.equal(
      composeQuickShareCaption(BRAND, boldSuffix),
      `${BRAND}\n${boldSuffix}`,
    );
  });

  it('handles edge case 10: does not duplicate headings if already present', () => {
    const alreadyFormatted = [
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

    // Calling formatTransformationCaption on an already formatted caption
    const result = formatTransformationCaption(alreadyFormatted);
    assert.equal(result, alreadyFormatted);

    // Ensure count of headings is exactly 1
    const dayProgressCount = (result.match(/DAY PROGRESS/g) || []).length;
    const lapProgressCount = (result.match(/LAP PROGRESS/g) || []).length;
    assert.equal(dayProgressCount, 1);
    assert.equal(lapProgressCount, 1);
  });

  it('ensures output contains actual newline characters and no literal backslash-n', () => {
    const suffixWithLiteralNewlines =
      'Ideal: 79.57 kg\\nPrev: 80 kg\\nCurr: 80 kg\\nMarathon Day 5\\nDay 0 : — → Curr: 80.00 kg';
    const result = composeQuickShareCaption(BRAND, suffixWithLiteralNewlines);
    assert.ok(!result.includes('\\n'), 'Should not contain literal \\n string');
    assert.ok(result.includes('\n'), 'Should contain actual newline character');
  });
});
