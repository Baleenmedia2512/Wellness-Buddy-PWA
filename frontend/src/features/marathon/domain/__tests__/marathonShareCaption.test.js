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
import { buildMarathonRunningProgress, buildMarathonGapProgress } from '../marathonWeightComparison.js';

const CURRENT_DAY_CAPTION = 'BALAJI · Wellness Valley v 3.4.4, Previous: 73.65 kg, Current: 73.4 kg';

function runningProgress(weightsByDay, currentMarathonDay) {
  const dayYmds = Array.from({ length: 11 }, (_, day) => `2026-09-${String(day + 1).padStart(2, '0')}`);
  return buildMarathonRunningProgress({
    currentDay0Ymd: '2026-09-01',
    marathonNumber: 1,
    currentMarathonDay,
    dayYmds,
    weightsByDay,
  });
}

describe('MARATHON_WHATSAPP_ADVANCE_SPECIALS', () => {
  it('keeps only Marathon start and Detox Days as specials', () => {
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
    assert.equal(
      formatMarathonWhatsAppCurrentDayNotice(1),
      'Day 1',
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
      getMarathonWhatsAppCurrentDayNotice('2026-08-03'),
      'Day 2',
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

  it('returns null on ordinary days including Day 0, Day 1, and Day 2', () => {
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-01'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-02'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-03'), null);
    assert.equal(getMarathonWhatsAppAdvanceNotice('2026-08-05'), null);
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
  it('uses Tomorrow only for Marathon start and Detox; other days are Day N', () => {
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-07-31'),
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 0 - Marathon Starts`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-14'),
      `${CURRENT_DAY_CAPTION}, Tomorrow is Day 0 - Marathon Starts`,
    );
    assert.equal(
      appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-01'),
      `${CURRENT_DAY_CAPTION}, Day 0 - Marathon Starts`,
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

  it('appends Day 0 weight only on marathon Day 0', () => {
    const progress = runningProgress({ 0: 73 }, 0);
    const result = appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-09-01', progress);
    assert.equal(result, `${CURRENT_DAY_CAPTION}, Day 0 - Marathon Starts, 73.0 kg`);
  });

  it('appends Day 0 vs current day comparison on marathon Day 1-10', () => {
    const progress = runningProgress({ 0: 75, 1: 74.5 }, 1);
    const result = appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-09-02', progress);
    assert.equal(
      result,
      `${CURRENT_DAY_CAPTION}, Day 1, 75.0 kg → 74.5 kg ↓ 0.5 kg`,
    );
  });

  it('appends gap comparison on non-running days', () => {
    const progress = buildMarathonGapProgress({
      previousMarathonEndWeight: 74,
      currentWeight: 74.2,
      previousDay10Ymd: '2026-08-11',
    });
    const result = appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-26', progress);
    assert.match(result, /Previous Marathon End weight : 74\.0 kg/);
    assert.match(result, /Current Weight : 74\.2 kg ↑/);
  });

  it('does not append weight lines on marathon eve reminders', () => {
    const progress = buildMarathonGapProgress({
      previousMarathonEndWeight: 74,
      currentWeight: 74.2,
    });
    const result = appendMarathonWhatsAppNotice(CURRENT_DAY_CAPTION, '2026-08-14', progress);
    assert.equal(result, `${CURRENT_DAY_CAPTION}, Tomorrow is Day 0 - Marathon Starts`);
    assert.equal(result.includes('Previous Marathon End weight'), false);
  });

  it('returns the day sequence when the caption is empty', () => {
    assert.equal(
      appendMarathonWhatsAppNotice('', '2026-08-14'),
      'Tomorrow is Day 0 - Marathon Starts',
    );
    assert.equal(
      appendMarathonWhatsAppNotice('', '2026-08-02'),
      'Day 1',
    );
  });
});
