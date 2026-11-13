import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDiaryPostToday, assertDiaryPostEditableOrDeletable } from '../diaryPostLock.rules.js';
import { todayInTimezone, shiftDateYmd, IANA_IST } from '../datetime/index.js';

describe('diaryPostLock.rules', () => {
  it('allows today timestamps', () => {
    const todayYmd = todayInTimezone(IANA_IST);
    const todayTimestamp = `${todayYmd} 10:30:00`;
    assert.equal(isDiaryPostToday(todayTimestamp, IANA_IST), true);
  });

  it('rejects yesterday timestamps', () => {
    const todayYmd = todayInTimezone(IANA_IST);
    const yesterdayYmd = shiftDateYmd(todayYmd, -1, IANA_IST);
    const yesterdayTimestamp = `${yesterdayYmd} 21:00:00`;
    assert.equal(isDiaryPostToday(yesterdayTimestamp, IANA_IST), false);
  });

  it('rejects older timestamps', () => {
    assert.equal(isDiaryPostToday('2025-01-01 12:00:00', IANA_IST), false);
  });

  it('rejects null or undefined timestamps', () => {
    assert.equal(isDiaryPostToday(null, IANA_IST), false);
    assert.equal(isDiaryPostToday(undefined, IANA_IST), false);
    assert.equal(isDiaryPostToday('', IANA_IST), false);
  });

  it('assertDiaryPostEditableOrDeletable returns 403 errorResponse for previous days', async () => {
    const todayYmd = todayInTimezone(IANA_IST);
    const yesterdayYmd = shiftDateYmd(todayYmd, -1, IANA_IST);
    const yesterdayTimestamp = `${yesterdayYmd} 15:00:00`;

    const deleteCheck = await assertDiaryPostEditableOrDeletable(yesterdayTimestamp, 999999, 'delete');
    assert.equal(deleteCheck.allowed, false);
    assert.equal(deleteCheck.errorResponse.httpStatus, 403);
    assert.equal(deleteCheck.errorResponse.body.success, false);
    assert.equal(deleteCheck.errorResponse.body.message, 'Diary posts from previous days cannot be deleted.');

    const editCheck = await assertDiaryPostEditableOrDeletable(yesterdayTimestamp, 999999, 'edit');
    assert.equal(editCheck.allowed, false);
    assert.equal(editCheck.errorResponse.httpStatus, 403);
    assert.equal(editCheck.errorResponse.body.message, 'Diary posts from previous days cannot be edited.');
  });

  it('assertDiaryPostEditableOrDeletable returns allowed=true for today', async () => {
    const todayYmd = todayInTimezone(IANA_IST);
    const todayTimestamp = `${todayYmd} 11:00:00`;

    const result = await assertDiaryPostEditableOrDeletable(todayTimestamp, 999999, 'delete');
    assert.equal(result.allowed, true);
    assert.equal(result.errorResponse, undefined);
  });
});

