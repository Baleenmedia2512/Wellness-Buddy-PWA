/**
 * marathon.policy.test.js — Unit tests for marathon authorization policy.
 */
import {
  canManageMarathon,
  canGenerateCard,
  canReadPublicCard,
} from '../domain/permissions/marathon.policy.js';

describe('canManageMarathon', () => {
  it('allows coaches', ()    => expect(canManageMarathon({ role: 'coach' })).toBe(true));
  it('allows admins', ()     => expect(canManageMarathon({ role: 'admin' })).toBe(true));
  it('allows developers', () => expect(canManageMarathon({ role: 'developer' })).toBe(true));
  it('denies users', ()      => expect(canManageMarathon({ role: 'user' })).toBe(false));
  it('denies uplines', ()    => expect(canManageMarathon({ role: 'upline' })).toBe(false));
  it('denies unknown roles', () => expect(canManageMarathon({ role: 'unknown' })).toBe(false));
});

describe('canGenerateCard', () => {
  it('allows when coach IDs match', () => {
    expect(canGenerateCard({ requestingCoachId: 42, marathonCoachId: 42, role: 'coach' })).toBe(true);
  });

  it('denies when coach IDs differ', () => {
    expect(canGenerateCard({ requestingCoachId: 42, marathonCoachId: 99, role: 'coach' })).toBe(false);
  });

  it('allows admins regardless of coach ID', () => {
    expect(canGenerateCard({ requestingCoachId: 1, marathonCoachId: 999, role: 'admin' })).toBe(true);
  });

  it('allows developers regardless of coach ID', () => {
    expect(canGenerateCard({ requestingCoachId: 1, marathonCoachId: 999, role: 'developer' })).toBe(true);
  });

  it('handles string/number type coercion', () => {
    expect(canGenerateCard({ requestingCoachId: '42', marathonCoachId: 42, role: 'coach' })).toBe(true);
  });
});

describe('canReadPublicCard', () => {
  it('always returns true', () => {
    expect(canReadPublicCard()).toBe(true);
  });
});
