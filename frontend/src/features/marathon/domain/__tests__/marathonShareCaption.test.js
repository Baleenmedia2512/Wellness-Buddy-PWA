/**
 * Run: node --test frontend/src/features/marathon/domain/__tests__/marathonShareCaption.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARATHON_WHATSAPP_ADVANCE_SPECIALS,
  formatMarathonWhatsAppAdvanceNotice,
  formatMarathonWhatsAppCurrentDayNotice,
  getMarathonWhatsAppCurrentDayNotice,
  getMarathonWhatsAppAdvanceNotice,
  appendMarathonWhatsAppNotice,
} from '../marathonShareCaption.js';

const CURRENT_DAY_CAPTION = 'BALAJI · Wellness Valley v 3.4.4, Previous: 73.65 kg, Current: 73.4 kg';

describe('MARATHON_WHATSAPP_ADVANCE_SPECIALS', () => {
  it('keeps Detox Days in sync with the calendar and supports extra specials by table', () => {
    const days = MARATHON_WHATSAPP_ADVANCE_SPECIALS.map((special) => special.day);
    assert.deepEqual(days, [0, 4, 9]);
    assert.equal(
      formatMarathonWhatsAppAdvanceNotice(0, 'Marathon Starts'),
      'Tomorrow is Day 0 - Marathon Starts',
    );
    assert.equal(
      formatMarathonWhatsAppCurrentDayNotice(0, 'Marathon Starts'),
      'Day 0 - Marathon Starts',
    );
  });
});

describe('getMarathonWhatsAppCurrentDayNotice', () => {
  it('returns the current marathon day on every in-marathon day', () => {
    assert.equal(
      getMarathonWhatsAppCurrentDayNotice('2026-08-01'),
      'Day 0 - Marathon Starts',
    );
    assert.equal(
      getMarathonWhatsAppCurrentDayNotice('2026-08-02'),
      'Day 1',
    );
    assert.equal(
      getMarathonWhatsAppCurrentDayNotice('2026-08-05'),
      'Day 4 - Detox Day',
    );
    assert.equal(
      getMarathonWhatsAppCurrentDayNotice('2026-08-10'),
      'Day 9 - Detox Day',
    );
  });

  it('returns null outside the marathon, including Day -1', () => {
    assert.equal(getMarathonWhatsAppCurrentDayNotice('2026-07-31'), null);
    assert.equal(getMarathonWhatsAppCurrentDayNotice('2026-08-12'), null);
    assert.equal(getMarathonWhatsAppCurrentDayNotice(null), null);
  });
});

describe('getMarathonWhatsAppAdvanceNotice', () => {
  it('returns Day 0 marathon-start copy on Day -1 (eve of the 1st and 15th)', () => {
    assert.equal(
      getMarathonWhatsAppAdvanceNotice('2026-07-31'),
      'Tomorrow is Day 0 - Marathon Starts',
    );
    assert.equal(
      getMarathonWhatsAppAdvanceNotice('2026-08-14'),
      'Tomorrow is Day 0 - Marathon Starts',
    );
  });

  it('returns Detox copy one day before each Detox Day', () => {
    assert.equal(
      getMarathonWhatsAppAdvanceNotice('2026-08-04'),
      'Tomorrow is Day 4 - Detox Day',
    );
    assert.equal(
      getMarathonWhatsAppAdvanceNotice('2026-08-09'),
      'Tomorrow is Day 9 - Detox Day',
    );
    assert.equal(
      getMarathonWhatsAppAdvanceNotice('2026-08-18'),
      'Tomorrow is Day 4 - Detox Day',
    );
    assert.equal(
      getMarathonWhatsAppAdvanceNotice('2026-08-23'),
      'Tomorrow is Day 9 - Detox Day',
    );
  });

  it('returns null on Day 0, Detox Days, and other in-sequence days', () => {
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-01'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-02'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-05'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-10'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-11'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-15'), null);
  });

  it('returns null outside the marathon (except Day -1)', () => {
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-12'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-13'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-26'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice(null), null);
  });
});

describe('appendMarathonWhatsAppNotice', () => {
  it('keeps current-day content and adds only the tomorrow line on Day -1, 3, and 8', () => {
    const dayMinus1 = appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-07-31');
    assert.ok(dayMinus1.startsWith(CURRENT_DAY_CAPTION));
    assert.ok(dayMinus1.includes('Tomorrow is Day 0 - Marathon Starts'));
    assert.equal(
      dayMinus1,
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 0 - Marathon Starts`,
    );

    const day3 = appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-04');
    assert.ok(day3.startsWith(CURRENT_DAY_CAPTION));
    assert.equal(
      day3,
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 4 - Detox Day`,
    );
    assert.equal(day3.includes('Day 3'), false);

    const day8 = appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-09');
    assert.ok(day8.startsWith(CURRENT_DAY_CAPTION));
    assert.equal(
      day8,
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 9 - Detox Day`,
    );
    assert.equal(day8.includes('Day 8'), false);
  });

  it('adds the current day during the marathon and leaves non-marathon days untouched', () => {
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-01'),
      `${CURRENT_DAY_CAPTION}, Day 0 - Marathon Starts`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-05'),
      `${CURRENT_DAY_CAPTION}, Day 4 - Detox Day`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-02'),
      `${CURRENT_DAY_CAPTION}, Day 1`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-12'),
      CURRENT_DAY_CAPTION,
    );
  });

  it('does not duplicate an existing Tomorrow line', () => {
    const once = appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-04');
    const twice = appendMarathonWhatsAppNotice(once, '2026-08-04');
    assert.equal(twice, once);
    assert.equal(twice.split('Tomorrow is Day 4 - Detox Day').length - 1, 1);
  });

  it('uses a newline separator for multi-line captions', () => {
    const education = '🎓 Education\n\nPlatform: Zoom\nSession: Daily Education';
    assert.equal(
      appendMarathonWhatsAppNotice(education, '2026-08-04'),
      `${education}\nTomorrow is Day 4 - Detox Day`,
    );
  });

  it('returns the day sequence when the caption is empty', () => {
    assert.equal(
      appendMarathonWhatsAppNotice('', '2026-08-14'),
      'Tomorrow is Day 0 - Marathon Starts',
    );
    assert.equal(
      appendMarathonWhatsAppNotice('', '2026-08-01'),
      'Day 0 - Marathon Starts',
    );
    assert.equal(
      appendMarathonWhatsAppNotice('', '2026-08-04'),
      'Tomorrow is Day 4 - Detox Day',
    );
    assert.equal(
      appendMarathonWhatsAppNotice('   ', '2026-08-01'),
      'Day 0 - Marathon Starts',
    );
  });
});
