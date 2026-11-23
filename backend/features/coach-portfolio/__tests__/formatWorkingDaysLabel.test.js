/**
 * Run: node --test backend/features/coach-portfolio/__tests__/formatWorkingDaysLabel.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatWorkingDaysLabel } from '../domain/formatWorkingDaysLabel.js';

describe('formatWorkingDaysLabel', () => {
  it('formats Mon - Fri for weekday range', () => {
    assert.equal(
      formatWorkingDaysLabel([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
      ]),
      'Mon - Fri',
    );
  });

  it('lists non-contiguous days', () => {
    assert.equal(
      formatWorkingDaysLabel(['Monday', 'Wednesday', 'Friday']),
      'Mon, Wed, Fri',
    );
  });

  it('returns empty for no days', () => {
    assert.equal(formatWorkingDaysLabel([]), '');
  });
});
