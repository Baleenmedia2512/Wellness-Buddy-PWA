/**
 * Run: node --test frontend/src/features/marathon/domain/__tests__/marathonCalendar.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMarathonCalendarState,
  getDetoxReminder,
  resolveMarathonToday,
  DETOX_REMINDER_TITLE,
  DETOX_REMINDER_SUBTITLE,
  DETOX_REMINDER_MARATHON_DAYS,
  MARATHON_START_REMINDER_TITLE,
  MARATHON_START_REMINDER_SUBTITLE,
} from '../marathonCalendar.js';

function expectState(ymd, partial) {
  const state = getMarathonCalendarState(ymd);
  for (const [key, value] of Object.entries(partial)) {
    assert.equal(state[key], value, `${ymd} ${key}`);
  }
}

describe('getMarathonCalendarState — marathon 1 (starts on the 1st)', () => {
  it('maps Day 0 through Day 10 from the 1st', () => {
    expectState('2026-08-01', { inMarathon: true, marathonNumber: 1, marathonDay: 0, isDetoxDay: false, showDetoxReminder: false, showMarathonStartReminder: false });
    expectState('2026-08-02', { marathonDay: 1, showDetoxReminder: false });
    expectState('2026-08-03', { marathonDay: 2, showDetoxReminder: false });
    expectState('2026-08-04', { marathonDay: 3, showDetoxReminder: true, isDetoxDay: false });
    expectState('2026-08-05', { marathonDay: 4, isDetoxDay: true, showDetoxReminder: false });
    expectState('2026-08-09', { marathonDay: 8, showDetoxReminder: true, isDetoxDay: false });
    expectState('2026-08-10', { marathonDay: 9, isDetoxDay: true, showDetoxReminder: false });
    expectState('2026-08-11', { marathonDay: 10, inMarathon: true, showDetoxReminder: false, isDetoxDay: false });
  });

  it('is outside the marathon on the days between marathon 1 and 2', () => {
    expectState('2026-08-12', { inMarathon: false, marathonDay: null, showDetoxReminder: false, showMarathonStartReminder: false });
    expectState('2026-08-13', { inMarathon: false, showMarathonStartReminder: false });
    expectState('2026-08-14', { inMarathon: false, showMarathonStartReminder: true, marathonNumber: 2 });
  });
});

describe('getMarathonCalendarState — marathon 2 (starts on the 15th)', () => {
  it('maps Day 0 through Day 10 from the 15th', () => {
    expectState('2026-08-15', { inMarathon: true, marathonNumber: 2, marathonDay: 0, showDetoxReminder: false, showMarathonStartReminder: false });
    expectState('2026-08-18', { marathonNumber: 2, marathonDay: 3, showDetoxReminder: true });
    expectState('2026-08-19', { marathonDay: 4, isDetoxDay: true, showDetoxReminder: false });
    expectState('2026-08-23', { marathonDay: 8, showDetoxReminder: true });
    expectState('2026-08-24', { marathonDay: 9, isDetoxDay: true, showDetoxReminder: false });
    expectState('2026-08-25', { marathonDay: 10, inMarathon: true, showDetoxReminder: false });
  });

  it('is outside the marathon after Day 10 through month end, except eve of next Day 0', () => {
    expectState('2026-08-26', { inMarathon: false, showDetoxReminder: false, showMarathonStartReminder: false });
    expectState('2026-08-31', { inMarathon: false, showDetoxReminder: false, showMarathonStartReminder: true, marathonNumber: 1 });
  });
});

describe('getMarathonCalendarState — eve of Marathon Day 0', () => {
  it('flags the day before each start (14th and last day of month)', () => {
    expectState('2026-07-31', { showMarathonStartReminder: true, marathonNumber: 1, inMarathon: false, marathonDay: null });
    expectState('2026-08-14', { showMarathonStartReminder: true, marathonNumber: 2, inMarathon: false });
    expectState('2026-02-28', { showMarathonStartReminder: true, marathonNumber: 1 });
    expectState('2028-02-29', { showMarathonStartReminder: true, marathonNumber: 1 });
    expectState('2026-01-14', { showMarathonStartReminder: true, marathonNumber: 2 });
  });
});

describe('getMarathonCalendarState — repeats every month without hardcoded dates', () => {
  it('uses the same day-of-month rules in January, February, and December', () => {
    expectState('2026-01-04', { marathonNumber: 1, marathonDay: 3, showDetoxReminder: true });
    expectState('2026-01-18', { marathonNumber: 2, marathonDay: 3, showDetoxReminder: true });
    expectState('2026-02-09', { marathonNumber: 1, marathonDay: 8, showDetoxReminder: true });
    expectState('2026-02-23', { marathonNumber: 2, marathonDay: 8, showDetoxReminder: true });
    expectState('2026-12-01', { marathonNumber: 1, marathonDay: 0 });
    expectState('2026-12-15', { marathonNumber: 2, marathonDay: 0 });
    expectState('2026-12-25', { marathonNumber: 2, marathonDay: 10 });
  });

  it('does not treat non-eve leftover days as a marathon', () => {
    expectState('2026-01-30', { inMarathon: false, showMarathonStartReminder: false });
    expectState('2026-01-31', { inMarathon: false, showMarathonStartReminder: true, marathonNumber: 1 });
    expectState('2026-04-29', { inMarathon: false, showMarathonStartReminder: false });
    expectState('2026-04-30', { inMarathon: false, showMarathonStartReminder: true, marathonNumber: 1 });
  });

  it('returns empty state for invalid input', () => {
    expectState(null, { inMarathon: false, showDetoxReminder: false, showMarathonStartReminder: false });
    expectState(undefined, { inMarathon: false });
    expectState('', { inMarathon: false });
    expectState('2026-08', { inMarathon: false });
    expectState('08-04-2026', { inMarathon: false });
  });
});

describe('getDetoxReminder', () => {
  it('returns Home copy only on marathon Days 3 and 8', () => {
    const day3 = getDetoxReminder('2026-08-04');
    assert.equal(day3.title, DETOX_REMINDER_TITLE);
    assert.equal(day3.subtitle, DETOX_REMINDER_SUBTITLE);
    assert.equal(day3.marathonDay, 3);
    assert.equal(day3.marathonNumber, 1);
    assert.equal(day3.kind, 'detox');

    const day8 = getDetoxReminder('2026-08-09');
    assert.equal(day8.marathonDay, 8);
    assert.equal(day8.title, 'Tomorrow is Detox Day');

    const marathon2Day3 = getDetoxReminder('2026-08-18');
    assert.equal(marathon2Day3.marathonNumber, 2);
    assert.equal(marathon2Day3.marathonDay, 3);
  });

  it('returns Marathon Day 1 copy one day before Day 0', () => {
    const beforeFirst = getDetoxReminder('2026-07-31');
    assert.equal(beforeFirst.title, MARATHON_START_REMINDER_TITLE);
    assert.equal(beforeFirst.subtitle, MARATHON_START_REMINDER_SUBTITLE);
    assert.equal(beforeFirst.kind, 'marathon-start');
    assert.equal(beforeFirst.marathonNumber, 1);
    assert.equal(beforeFirst.marathonDay, null);

    const beforeFifteenth = getDetoxReminder('2026-08-14');
    assert.equal(beforeFifteenth.title, 'Tomorrow is Marathon Day 1');
    assert.equal(beforeFifteenth.kind, 'marathon-start');
    assert.equal(beforeFifteenth.marathonNumber, 2);

    const leapEve = getDetoxReminder('2028-02-29');
    assert.equal(leapEve.kind, 'marathon-start');
    assert.equal(leapEve.marathonNumber, 1);
  });

  it('returns null on Detox Days, start/end days, and days outside reminder windows', () => {
    assert.equal(getDetoxReminder('2026-08-01'), null);
    assert.equal(getDetoxReminder('2026-08-05'), null);
    assert.equal(getDetoxReminder('2026-08-10'), null);
    assert.equal(getDetoxReminder('2026-08-11'), null);
    assert.equal(getDetoxReminder('2026-08-12'), null);
    assert.equal(getDetoxReminder('2026-08-15'), null);
    assert.equal(getDetoxReminder('2026-08-19'), null);
    assert.equal(getDetoxReminder('2026-08-26'), null);
    assert.equal(getDetoxReminder('2026-08-30'), null);
  });

  it('derives reminder days as one day before each Detox Day', () => {
    assert.deepEqual([...DETOX_REMINDER_MARATHON_DAYS], [3, 8]);
  });
});

describe('resolveMarathonToday', () => {
  it('uses a valid YYYY-MM-DD override for QA', () => {
    assert.equal(resolveMarathonToday('2026-08-13', '2026-08-18'), '2026-08-18');
  });

  it('falls back to the live date when the override is missing or invalid', () => {
    assert.equal(resolveMarathonToday('2026-08-13', null), '2026-08-13');
    assert.equal(resolveMarathonToday('2026-08-13', '18-08-2026'), '2026-08-13');
    assert.equal(resolveMarathonToday('2026-08-13', ''), '2026-08-13');
  });
});
