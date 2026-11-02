/**
 * Owner-timezone display: India vs Qatar vs USA.
 * Run: node --test frontend/src/shared/utils/__tests__/datetimeUtils.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBusinessTime,
  formatBusinessDateTime,
  formatCalendarPickerDate,
  todayBusinessDate,
  addCalendarDaysYmd,
  formatPickerDayButtonLabel,
  formatOwnerDayLabel,
  isPickerDateToday,
  isPickerDateYesterday,
  isPickerDateFuture,
  isBusinessYesterday,
} from '../datetimeUtils.js';

const IST = 'Asia/Kolkata';
const QATAR = 'Asia/Qatar';
const USA_EAST = 'America/New_York';

// 8:31 PM IST on 17 Aug 2026 = 15:01 UTC
const DINNER_UTC = '2026-08-17T15:01:00.000Z';

describe('formatBusinessTime — owner local clocks', () => {
  it('shows the same instant as India evening, Qatar afternoon, USA morning', () => {
    assert.equal(formatBusinessTime(DINNER_UTC, IST), '8:31 PM');
    assert.equal(formatBusinessTime(DINNER_UTC, QATAR), '6:01 PM');
    assert.equal(formatBusinessTime(DINNER_UTC, USA_EAST), '11:01 AM');
  });
});

describe('formatBusinessDateTime — owner local date + time', () => {
  it('keeps the calendar day in the owner zone', () => {
    assert.match(formatBusinessDateTime(DINNER_UTC, IST), /Aug 17.*8:31 PM/);
    assert.match(formatBusinessDateTime(DINNER_UTC, QATAR), /Aug 17.*6:01 PM/);
    assert.match(formatBusinessDateTime(DINNER_UTC, USA_EAST), /Aug 17.*11:01 AM/);
  });
});

describe('Today vs Yesterday — owner zone', () => {
  it('adds calendar days without timezone shift', () => {
    assert.equal(addCalendarDaysYmd('2026-08-18', -1), '2026-08-17');
    assert.equal(addCalendarDaysYmd('2026-03-01', -1), '2026-02-28');
  });

  it('labels Today / Yesterday from the owner calendar, not the viewer', () => {
    // 2026-08-18 00:30 IST = still 17 Aug in Qatar and USA
    const now = new Date('2026-08-17T19:00:00.000Z');
    const indiaToday = new Date(2026, 7, 18);
    const qatarToday = new Date(2026, 7, 17);

    assert.equal(formatPickerDayButtonLabel(indiaToday, IST, now), 'Today');
    assert.equal(formatPickerDayButtonLabel(qatarToday, QATAR, now), 'Today');
    assert.equal(formatPickerDayButtonLabel(qatarToday, IST, now), 'Yesterday');

    assert.equal(isPickerDateToday(indiaToday, IST, now), true);
    assert.equal(isPickerDateToday(indiaToday, QATAR, now), false);
    assert.equal(isPickerDateYesterday(qatarToday, IST, now), true);
    assert.equal(isPickerDateFuture(indiaToday, QATAR, now), true);
  });

  it('timeline header uses owner Today / Yesterday', () => {
    const now = new Date('2026-08-17T19:00:00.000Z');
    assert.match(formatOwnerDayLabel('2026-08-18', IST, now), /^Today /);
    assert.match(formatOwnerDayLabel('2026-08-17', QATAR, now), /^Today /);
    assert.match(formatOwnerDayLabel('2026-08-17', IST, now), /^Yesterday /);
    assert.match(formatOwnerDayLabel('2026-08-16', QATAR, now), /^Yesterday /);
  });

  it('isBusinessYesterday uses the previous owner calendar day (not UTC midnight)', () => {
    const now = new Date('2026-08-18T16:00:00.000Z'); // noon EDT Aug 18
    const yesterdayAfternoonEd = '2026-08-17T19:00:00.000Z'; // 3pm EDT Aug 17
    assert.equal(isBusinessYesterday(yesterdayAfternoonEd, USA_EAST, now), true);
  });

  it('USA can still be on marathon eve while India is already Day 0', () => {
    const now = new Date('2026-08-14T22:00:00.000Z');
    assert.equal(todayBusinessDate(USA_EAST, now), '2026-08-14');
    assert.equal(todayBusinessDate(IST, now), '2026-08-15');
  });
});
