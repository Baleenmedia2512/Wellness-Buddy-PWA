/**
 * Run: node --test frontend/src/features/nutrition-centers/domain/__tests__/centerListRefresh.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { omitRemovedCenters } from '../centerListRefresh.js';

describe('omitRemovedCenters', () => {
  it('keeps the list when nothing was deleted', () => {
    const rows = [{ id: 1, center_name: 'A' }];
    assert.deepEqual(omitRemovedCenters(rows, new Set()), rows);
  });

  it('hides a club that was just deleted even if the refetch still returns it', () => {
    const rows = [
      { id: 4, center_name: 'Gone' },
      { id: 9, center_name: 'Stay' },
    ];
    assert.deepEqual(omitRemovedCenters(rows, new Set([4])), [{ id: 9, center_name: 'Stay' }]);
  });
});
