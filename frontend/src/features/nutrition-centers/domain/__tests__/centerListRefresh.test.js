/**
 * Run: node --test frontend/src/features/nutrition-centers/domain/__tests__/centerListRefresh.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySavedCenter,
  omitRemovedCenters,
  savedCenterTotalRecords,
  toClubListRow,
} from '../centerListRefresh.js';

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

describe('toClubListRow', () => {
  it('maps a create response onto the club list shape', () => {
    assert.deepEqual(
      toClubListRow({
        id: 12,
        center_name: 'New Club',
        latitude: 11.1,
        longitude: 77.2,
        owner_user_id: 4,
        owner_phone: '+919999999999',
      }, 'Coach A'),
      {
        id: 12,
        center_name: 'New Club',
        latitude: 11.1,
        longitude: 77.2,
        education_hour: null,
        owner_user_id: 4,
        owner_phone: '+919999999999',
        ownerName: 'Coach A',
      },
    );
  });
});

describe('applySavedCenter', () => {
  it('puts a new club at the top immediately', () => {
    const rows = [{ id: 2, center_name: 'Old', todayAttendance: 3 }];
    const next = applySavedCenter(rows, {
      id: 9,
      center_name: 'New',
      ownerName: 'Coach',
    });
    assert.equal(next[0].id, 9);
    assert.equal(next[0].center_name, 'New');
    assert.equal(next[0].todayAttendance, 0);
    assert.equal(next[1].id, 2);
  });

  it('updates the matching club and keeps its attendance', () => {
    const rows = [{
      id: 9,
      center_name: 'Old Name',
      ownerName: 'Coach',
      owner_phone: '+911111111111',
      todayAttendance: 4,
      attendancePercentage: 100,
      totalParticipants: 4,
    }];
    const next = applySavedCenter(rows, {
      id: 9,
      center_name: 'New Name',
      owner_phone: '+919999999999',
      ownerName: 'Coach',
    });
    assert.equal(next.length, 1);
    assert.equal(next[0].center_name, 'New Name');
    assert.equal(next[0].owner_phone, '+919999999999');
    assert.equal(next[0].todayAttendance, 4);
    assert.equal(next[0].attendancePercentage, 100);
  });
});

describe('savedCenterTotalRecords', () => {
  it('increments only when the club is new', () => {
    const rows = [{ id: 2 }];
    assert.equal(savedCenterTotalRecords(8, rows, { id: 9 }, false), 9);
    assert.equal(savedCenterTotalRecords(8, [...rows, { id: 9 }], { id: 9 }, false), 8);
  });

  it('starts at one when switching onto My Club', () => {
    assert.equal(savedCenterTotalRecords(40, [{ id: 2 }], { id: 9 }, true), 1);
  });
});
