/**
 * Run: node --test backend/utils/__tests__/teamHierarchySearchPayload.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  slimSearchAllMembers,
  slimSearchMember,
} from '../teamHierarchySearchPayload.js';

describe('slimSearchMember', () => {
  it('keeps search identity fields including club and phone', () => {
    const slim = slimSearchMember({
      UserId: 12,
      UserName: 'Asha',
      Email: 'asha@example.com',
      CommunityId: 'C1',
      Role: 'user',
      CoachId: 3,
      CoCoachId: 4,
      Status: 'Active',
      phoneNumber: '9876543210',
      clubName: 'Chennai',
      height: 160,
      bmr: 1200,
      gender: 'female',
      age: 30,
      visceralFat: 8,
      bodyAge: 32,
      chestCm: 90,
      waistCm: 70,
      hipCm: 95,
      weightKg: 62,
      fatPercent: 28,
      bmi: 24,
    });
    assert.deepEqual(slim, {
      UserId: 12,
      UserName: 'Asha',
      Email: 'asha@example.com',
      CommunityId: 'C1',
      Role: 'user',
      CoachId: 3,
      CoCoachId: 4,
      Status: 'Active',
      phoneNumber: '9876543210',
      clubName: 'Chennai',
    });
  });

  it('keeps isCoCoach only when it is already true', () => {
    assert.equal(slimSearchMember({ UserId: 1, isCoCoach: true }).isCoCoach, true);
    assert.equal('isCoCoach' in slimSearchMember({ UserId: 1 }), false);
  });
});

describe('slimSearchAllMembers', () => {
  it('preserves member order and count', () => {
    const members = [
      { UserId: 2, UserName: 'B', height: 1 },
      { UserId: 1, UserName: 'A', weightKg: 9 },
    ];
    const slim = slimSearchAllMembers(members);
    assert.deepEqual(slim.map((row) => row.UserId), [2, 1]);
    assert.equal(slim.length, 2);
    assert.equal('height' in slim[0], false);
    assert.equal('weightKg' in slim[1], false);
  });
});
