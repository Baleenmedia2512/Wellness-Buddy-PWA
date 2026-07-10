/**
 * Unit tests — education vs smartwatch row discrimination.
 * Run: node --test backend/features/wellness-score/__tests__/education-log.helpers.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterEducationLogsOnly,
  isEducationLogRow,
  isSmartwatchEducationLogRow,
} from '../domain/education-log.helpers.js';

describe('education-log.helpers', () => {
  it('detects smartwatch by topic prefix', () => {
    assert.equal(isSmartwatchEducationLogRow({ Topic: 'Calories Burned: 200 kcal' }), true);
    assert.equal(isSmartwatchEducationLogRow({ Topic: 'calories burned: 50 kcal' }), true);
  });

  it('detects smartwatch by platform even without calories topic', () => {
    assert.equal(isSmartwatchEducationLogRow({ Platform: 'Apple Watch', Topic: 'Activity' }), true);
    assert.equal(isSmartwatchEducationLogRow({ Platform: 'Fitbit', Topic: 'Daily summary' }), true);
    assert.equal(isSmartwatchEducationLogRow({ Platform: 'Smartwatch', Topic: 'Steps' }), true);
  });

  it('does not treat education platforms as smartwatch', () => {
    assert.equal(isSmartwatchEducationLogRow({ Platform: 'Zoom', Topic: 'Hydration module' }), false);
    assert.equal(isSmartwatchEducationLogRow({ Platform: 'Google Meet', Topic: 'Session 2' }), false);
  });

  it('filters smartwatch rows from education logs', () => {
    const rows = [
      { Platform: 'Apple Watch', Topic: 'Calories Burned: 180 kcal', CreatedAt: '2026-07-08T07:00:00' },
      { Platform: 'Zoom', Topic: 'Session 2', CreatedAt: '2026-07-08T08:00:00' },
    ];
    const filtered = filterEducationLogsOnly(rows);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].Platform, 'Zoom');
  });

  it('education with no log stays not completed (no false late from watch)', () => {
    const onlyWatch = [
      { Platform: 'Garmin', Topic: 'Calories Burned: 90 kcal', CreatedAt: '2026-07-08T23:30:00' },
    ];
    assert.equal(filterEducationLogsOnly(onlyWatch).length, 0);
    assert.equal(isEducationLogRow(onlyWatch[0]), false);
  });
});
