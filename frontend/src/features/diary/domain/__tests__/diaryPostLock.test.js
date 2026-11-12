import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBusinessToday, todayBusinessDate, addCalendarDaysYmd, DEFAULT_BUSINESS_TIMEZONE } from '../../../../shared/utils/datetimeUtils.js';

describe('diaryPostLock frontend rules', () => {
  it('correctly identifies today entries in default business timezone', () => {
    const todayYmd = todayBusinessDate(DEFAULT_BUSINESS_TIMEZONE);
    const todayTimestamp = `${todayYmd}T10:30:00+05:30`;
    assert.equal(isBusinessToday(todayTimestamp, DEFAULT_BUSINESS_TIMEZONE), true);
  });

  it('correctly identifies yesterday entries as NOT today', () => {
    const todayYmd = todayBusinessDate(DEFAULT_BUSINESS_TIMEZONE);
    const yesterdayYmd = addCalendarDaysYmd(todayYmd, -1);
    const yesterdayTimestamp = `${yesterdayYmd}T21:00:00+05:30`;
    assert.equal(isBusinessToday(yesterdayTimestamp, DEFAULT_BUSINESS_TIMEZONE), false);
  });

  it('correctly identifies older entries as NOT today', () => {
    assert.equal(isBusinessToday('2025-01-01T12:00:00+05:30', DEFAULT_BUSINESS_TIMEZONE), false);
  });

  it('returns false for null or undefined timestamps', () => {
    assert.equal(isBusinessToday(null, DEFAULT_BUSINESS_TIMEZONE), false);
    assert.equal(isBusinessToday(undefined, DEFAULT_BUSINESS_TIMEZONE), false);
    assert.equal(isBusinessToday('', DEFAULT_BUSINESS_TIMEZONE), false);
  });
});

