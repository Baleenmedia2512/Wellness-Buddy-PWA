/**
 * Run: node --test backend/features/nutrition-centers/domain/__tests__/searchClub.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { primaryClubNameByOwner, resolveSearchClubName } from '../searchClub.rules.js';

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
  const clubs = new Map([[10, 'Member Club'], [20, 'Coach Club']]);

  it('uses the member club when they have one', () => {
    assert.equal(resolveSearchClubName({ userId: 10, coachId: 20 }, clubs), 'Member Club');
  });

  it('uses the coach club when the member has none', () => {
    assert.equal(resolveSearchClubName({ userId: 99, coachId: 20 }, clubs), 'Coach Club');
  });

  it('returns null when neither has a club', () => {
    assert.equal(resolveSearchClubName({ userId: 1, coachId: 2 }, clubs), null);
  });
});
