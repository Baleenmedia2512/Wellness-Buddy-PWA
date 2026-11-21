/**
 * Run: node --test backend/features/coach-portfolio/__tests__/clubHoursToPublicTimings.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clubHoursToPublicTimings } from '../domain/clubHoursToPublicTimings.js';

describe('clubHoursToPublicTimings', () => {
  it('maps open days and first slot times', () => {
    const result = clubHoursToPublicTimings({
      monday: { closed: false, slots: [{ open: '05:30', close: '13:00' }] },
      tuesday: { closed: false, slots: [{ open: '05:30', close: '13:00' }] },
      wednesday: { closed: true, slots: [] },
      thursday: { closed: false, slots: [{ open: '09:00', close: '18:00' }] },
      friday: { closed: true, slots: [] },
      saturday: { closed: true, slots: [] },
      sunday: { closed: true, slots: [] },
    });
    assert.deepEqual(result.workingDays, ['Monday', 'Tuesday', 'Thursday']);
    assert.equal(result.openingTime, '05:30');
    assert.equal(result.closingTime, '13:00');
  });

  it('returns empty when all closed or missing', () => {
    assert.deepEqual(clubHoursToPublicTimings(null), {
      workingDays: [],
      openingTime: '',
      closingTime: '',
    });
    assert.deepEqual(clubHoursToPublicTimings({
      monday: { closed: true, slots: [] },
      sunday: { closed: true, slots: [] },
    }), {
      workingDays: [],
      openingTime: '',
      closingTime: '',
    });
  });
});
