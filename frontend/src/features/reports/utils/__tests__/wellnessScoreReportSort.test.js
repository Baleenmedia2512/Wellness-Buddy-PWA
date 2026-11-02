/**
 * Run: node --test frontend/src/features/reports/utils/__tests__/wellnessScoreReportSort.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_SORT_KEYS,
  REPORT_SORT_DIRS,
  DEFAULT_SORT_DIR_BY_KEY,
  nextReportSortState,
} from '../wellnessScoreReportSort.js';

describe('nextReportSortState', () => {
  it('uses column default on first click', () => {
    assert.deepEqual(
      nextReportSortState(REPORT_SORT_KEYS.NAME, REPORT_SORT_KEYS.SCORE, REPORT_SORT_DIRS.DESC),
      { sort: REPORT_SORT_KEYS.NAME, sortDir: REPORT_SORT_DIRS.ASC },
    );
    assert.equal(DEFAULT_SORT_DIR_BY_KEY[REPORT_SORT_KEYS.WEIGHT], REPORT_SORT_DIRS.ASC);
  });

  it('toggles direction on repeated click', () => {
    assert.deepEqual(
      nextReportSortState(REPORT_SORT_KEYS.SCORE, REPORT_SORT_KEYS.SCORE, REPORT_SORT_DIRS.DESC),
      { sort: REPORT_SORT_KEYS.SCORE, sortDir: REPORT_SORT_DIRS.ASC },
    );
  });
});
