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

describe('calendar picker vs owner zone', () => {
  it('local-midnight Aug 18 is still Aug 18 even in Qatar or USA', () => {
    const picked = new Date(2026, 7, 18); // viewer-local midnight
    assert.equal(formatCalendarPickerDate(picked), '2026-08-18');
  });

  it('today in Qatar / USA / India can differ around midnight', () => {
    // 2026-08-18 00:30 IST = 2026-08-17 19:00 UTC
    const justAfterIstMidnight = new Date('2026-08-17T19:00:00.000Z');
    assert.equal(todayBusinessDate(IST, justAfterIstMidnight), '2026-08-18');
    assert.equal(todayBusinessDate(QATAR, justAfterIstMidnight), '2026-08-17');
    assert.equal(todayBusinessDate(USA_EAST, justAfterIstMidnight), '2026-08-17');
  });
});
