/**
 * Run: node --test backend/features/activity/__tests__/activity-time-windows.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ACTIVITY_TIME_WINDOWS,
  mergeActivityTimeWindowsWithDefaults,
} from '../../../shared/lib/activity-time-windows.js';

describe('activity-time-windows defaults', () => {
  it('fills all five activities from defaults when empty', () => {
    const merged = mergeActivityTimeWindowsWithDefaults({});
    assert.deepEqual(merged.weight, DEFAULT_ACTIVITY_TIME_WINDOWS.weight);
    assert.deepEqual(merged.education, DEFAULT_ACTIVITY_TIME_WINDOWS.education);
    assert.deepEqual(merged.breakfast, DEFAULT_ACTIVITY_TIME_WINDOWS.breakfast);
    assert.deepEqual(merged.lunch, DEFAULT_ACTIVITY_TIME_WINDOWS.lunch);
    assert.deepEqual(merged.dinner, DEFAULT_ACTIVITY_TIME_WINDOWS.dinner);
  });

  it('keeps saved windows and only fills missing types', () => {
    const merged = mergeActivityTimeWindowsWithDefaults({
      breakfast: { start: '05:30:00', end: '08:30:00' },
    });
    assert.equal(merged.breakfast.start, '05:30:00');
    assert.equal(merged.breakfast.end, '08:30:00');
    assert.deepEqual(merged.weight, DEFAULT_ACTIVITY_TIME_WINDOWS.weight);
  });
});
