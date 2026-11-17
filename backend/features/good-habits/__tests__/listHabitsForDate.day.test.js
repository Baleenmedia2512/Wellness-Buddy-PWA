/**
 * Score day filter must treat good-habit CreatedAt as IST wall clock
 * (same as diary), so evening logs do not leak into the next IST day.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterFoodRowsByCalendarDay,
  IANA_IST,
} from '../../../shared/lib/datetime/index.js';

describe('good-habit score day filter (IST wall clock)', () => {
  it('keeps an evening IST wall stamp on the same calendar day', () => {
    // Driver often stamps …Z on an IST wall value — must NOT shift to next day.
    const rows = [
      { CreatedAt: '2026-11-17T19:45:00.000Z', HabitType: 'image_notes' },
      { CreatedAt: '2026-11-17 19:45:00', HabitType: 'image_notes' },
    ];
    const today = filterFoodRowsByCalendarDay(rows, '2026-11-17', IANA_IST, 'CreatedAt');
    const tomorrow = filterFoodRowsByCalendarDay(rows, '2026-11-18', IANA_IST, 'CreatedAt');
    assert.equal(today.length, 2);
    assert.equal(tomorrow.length, 0);
  });

  it('does not count a late-evening wall clock on the next IST day', () => {
    const rows = [
      { CreatedAt: '2026-11-17T22:30:00.000Z', HabitType: 'image_notes' },
    ];
    assert.equal(
      filterFoodRowsByCalendarDay(rows, '2026-11-17', IANA_IST, 'CreatedAt').length,
      1,
    );
    assert.equal(
      filterFoodRowsByCalendarDay(rows, '2026-11-18', IANA_IST, 'CreatedAt').length,
      0,
    );
  });
});
