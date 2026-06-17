/**
 * card.policy.test.js — Permissions unit tests.
 */
import {
  canCreateCard,
  canSaveCardToProfile,
  canViewPublicCard,
  canSearchTeamPhones,
} from '../domain/permissions/card.policy.js';

describe('canCreateCard', () => {
  it('returns true for any authenticated user', () => {
    expect(canCreateCard({ isCoach: true })).toBe(true);
    expect(canCreateCard({ isCoach: false })).toBe(true);
  });

  it('returns false when user is null', () => {
    expect(canCreateCard(null)).toBe(false);
  });
});

describe('canSaveCardToProfile', () => {
  it('returns true when card userId matches requesting userId', () => {
    expect(canSaveCardToProfile(42, 42)).toBe(true);
  });

  it('returns false when user IDs differ', () => {
    expect(canSaveCardToProfile(42, 99)).toBe(false);
  });

  it('returns false when cardUserId is null', () => {
    expect(canSaveCardToProfile(null, 42)).toBe(false);
  });

  it('returns false when requestingId is null', () => {
    expect(canSaveCardToProfile(42, null)).toBe(false);
  });

  it('handles string vs number coercion', () => {
    expect(canSaveCardToProfile('42', 42)).toBe(true);
  });
});

describe('canViewPublicCard', () => {
  it('always returns true', () => {
    expect(canViewPublicCard()).toBe(true);
  });
});

describe('canSearchTeamPhones', () => {
  it('returns true for a valid numeric coachId', () => {
    expect(canSearchTeamPhones({ coachId: 5 })).toBe(true);
  });

  it('returns true for a string coachId', () => {
    expect(canSearchTeamPhones({ coachId: '12' })).toBe(true);
  });

  it('returns false when coachId is null', () => {
    expect(canSearchTeamPhones({ coachId: null })).toBe(false);
  });

  it('returns false when coachId is 0', () => {
    expect(canSearchTeamPhones({ coachId: 0 })).toBe(false);
  });

  it('returns false when called with no args', () => {
    expect(canSearchTeamPhones()).toBe(false);
  });
});
