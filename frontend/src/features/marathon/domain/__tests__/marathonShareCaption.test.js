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
    assert.deepEqual(days, [0, 1, 4, 9]);
    assert.equal(
      formatMarathonWhatsAppAdvanceNotice(0, 'Marathon Starts'),
      'Tomorrow is Day 0 - Marathon Starts',
    );
    assert.equal(
      formatMarathonWhatsAppAdvanceNotice(1, ''),
      'Tomorrow is Day 1',
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

  it('returns Day 1 copy on Day 0 (1st and 15th)', () => {
    assert.equal(
      getMarathonWhatsAppAdvanceNotice('2026-08-01'),
      'Tomorrow is Day 1',
    );
    assert.equal(
      getMarathonWhatsAppAdvanceNotice('2026-08-15'),
      'Tomorrow is Day 1',
    );
  });

  it('returns Tomorrow is Day N+1 on every in-marathon day except Day 10', () => {
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-02'), 'Tomorrow is Day 2');
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-03'), 'Tomorrow is Day 3');
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-05'), 'Tomorrow is Day 5');
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-10'), 'Tomorrow is Day 10');
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-11'), null);
  });

  it('returns null outside the marathon (except Day -1)', () => {
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-12'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-13'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-26'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice(null), null);
  });
});

describe('appendMarathonWhatsAppNotice', () => {
  it('adds only the tomorrow line on in-marathon days, and Day 10 on the last day', () => {
    const dayMinus1 = appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-07-31');
    assert.equal(
      dayMinus1,
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 0 - Marathon Starts`,
    );

    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-01'),
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 1`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-02'),
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 2`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-03'),
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 3`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-04'),
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 4 - Detox Day`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-09'),
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 9 - Detox Day`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-11'),
      `${CURRENT_DAY_CAPTION}, Day 10`,
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
    assert.equal(twice.includes('Day 3'), false);
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
      'Tomorrow is Day 1',
    );
    assert.equal(
      appendMarathonWhatsAppNotice('', '2026-08-02'),
      'Tomorrow is Day 2',
    );
    assert.equal(
      appendMarathonWhatsAppNotice('', '2026-08-04'),
      'Tomorrow is Day 4 - Detox Day',
    );
    assert.equal(
      appendMarathonWhatsAppNotice('   ', '2026-08-15'),
      'Tomorrow is Day 1',
    );
  });
});
