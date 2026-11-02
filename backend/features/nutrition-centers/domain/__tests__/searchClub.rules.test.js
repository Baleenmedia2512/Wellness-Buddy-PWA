/**
 * Run: node --test backend/features/nutrition-centers/domain/__tests__/searchClub.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  primaryClubNameByOwner,
  resolveSearchClubName,
  resolveWorkingPhysicalCentre,
  coachIdByUser,
} from '../searchClub.rules.js';

describe('primaryClubNameByOwner', () => {
  it('keeps the latest club when one person owns more than one', () => {
    const names = primaryClubNameByOwner([
      { id: 1, owner_user_id: 10, center_name: 'Old Club', registered_at: '2024-01-01T00:00:00Z' },
      { id: 2, owner_user_id: 10, center_name: 'New Club', registered_at: '2025-06-01T00:00:00Z' },
      { id: 3, owner_user_id: 11, center_name: 'Coach Club', registered_at: '2023-01-01T00:00:00Z' },
    ]);
    assert.equal(names.get(10), 'New Club');
    assert.equal(names.get(11), 'Coach Club');
  });
});

describe('resolveSearchClubName', () => {
  const clubs = new Map([
    [10, 'Member Club'],
    [20, 'Coach Club'],
    [30, 'Upline Club'],
  ]);
  const coaches = new Map([
    [10, 20],
    [20, 30],
    [99, 20],
    [40, 41],
    [41, 30],
    [1, 2],
    [2, null],
    [7, 8],
    [8, 7],
  ]);

  it('uses the member club when they have one', () => {
    assert.equal(resolveSearchClubName(10, clubs, coaches), 'Member Club');
  });

  it('uses the coach club when the member has none', () => {
    assert.equal(resolveSearchClubName(99, clubs, coaches), 'Coach Club');
  });

  it('uses the upline club when the member and their coach have none', () => {
    assert.equal(resolveSearchClubName(40, clubs, coaches), 'Upline Club');
  });

  it('returns null when no one up the chain has a club', () => {
    assert.equal(resolveSearchClubName(1, clubs, coaches), null);
  });

  it('stops if the coach chain loops', () => {
    assert.equal(resolveSearchClubName(7, clubs, coaches), null);
  });
});

describe('resolveWorkingPhysicalCentre', () => {
  const coaches = new Map([
    [10, 20],
    [20, 30],
    [99, 20],
    [40, 41],
    [41, 30],
    [1, 2],
    [2, null],
    [7, 8],
    [8, 7],
  ]);
  const centers = [
    { id: 1, owner_user_id: 10, center_name: 'Old Club', registered_at: '2024-01-01T00:00:00Z' },
    { id: 2, owner_user_id: 10, center_name: 'New Club', registered_at: '2025-06-01T00:00:00Z' },
    { id: 3, owner_user_id: 20, center_name: 'Coach Club', registered_at: '2023-01-01T00:00:00Z' },
    { id: 4, owner_user_id: 30, center_name: 'Upline Club', registered_at: '2022-01-01T00:00:00Z' },
  ];

  it('lists the member clubs and selects the latest', () => {
    const result = resolveWorkingPhysicalCentre(10, centers, coaches);
    assert.equal(result.name, 'New Club');
    assert.equal(result.id, 2);
    assert.deepEqual(result.options.map((opt) => opt.name), ['New Club', 'Old Club']);
  });

  it('uses the coach clubs when the member has none', () => {
    const result = resolveWorkingPhysicalCentre(99, centers, coaches);
    assert.equal(result.name, 'Coach Club');
    assert.equal(result.id, 3);
  });

  it('uses the upline clubs when the member and their coach have none', () => {
    const result = resolveWorkingPhysicalCentre(40, centers, coaches);
    assert.equal(result.name, 'Upline Club');
    assert.equal(result.id, 4);
  });

  it('returns no club when no one up the chain has one', () => {
    const result = resolveWorkingPhysicalCentre(1, centers, coaches);
    assert.equal(result.name, null);
    assert.deepEqual(result.options, []);
  });

  it('stops if the coach chain loops', () => {
    const result = resolveWorkingPhysicalCentre(7, centers, coaches);
    assert.equal(result.name, null);
  });
});

describe('coachIdByUser', () => {
  it('maps each user to their coach', () => {
    const map = coachIdByUser([
      { UserId: 40, CoachId: 41 },
      { UserId: 41, CoachId: 30 },
    ]);
    assert.equal(map.get(40), 41);
    assert.equal(map.get(41), 30);
  });
});
