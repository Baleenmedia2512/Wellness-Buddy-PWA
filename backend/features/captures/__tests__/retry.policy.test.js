/**
 * Unit tests for backend/features/captures/domain/permissions/retry.policy.js
 *
 * PURE module — no mocks, no I/O. Target: 100% lines / 100% branches.
 */
import {
  canRetryCapture,
  assertCanRetryCapture,
} from '../domain/permissions/retry.policy.js';

describe('canRetryCapture', () => {
  describe('allow paths', () => {
    it('allows the OWNER (string ids)', () => {
      expect(canRetryCapture({
        viewerId: '42', ownerId: '42', coachChain: ['42'],
      })).toEqual({ allowed: true, actorRole: 'OWNER' });
    });

    it('allows the OWNER (mixed numeric / string ids)', () => {
      expect(canRetryCapture({
        viewerId: 42, ownerId: '42', coachChain: [],
      })).toEqual({ allowed: true, actorRole: 'OWNER' });
    });

    it('allows a direct COACH (one hop up in the chain)', () => {
      // Convention: chain[0] === ownerId, chain[1+] are coach ancestors.
      expect(canRetryCapture({
        viewerId: '99', ownerId: '42', coachChain: ['42', '99'],
      })).toEqual({ allowed: true, actorRole: 'COACH' });
    });

    it('allows an ADMIN-level coach (deep in the chain, depth ≤ 10)', () => {
      expect(canRetryCapture({
        viewerId: '7',
        ownerId: '42',
        coachChain: ['42', '99', '88', '77', '7'],
      })).toEqual({ allowed: true, actorRole: 'COACH' });
    });

    it('allows when ids differ by type but stringify equal', () => {
      expect(canRetryCapture({
        viewerId: 99, ownerId: 42, coachChain: [42, 99],
      })).toEqual({ allowed: true, actorRole: 'COACH' });
    });
  });

  describe('deny paths', () => {
    it('denies a stranger NOT in the chain', () => {
      expect(canRetryCapture({
        viewerId: '500', ownerId: '42', coachChain: ['42', '99'],
      })).toEqual({ allowed: false, reason: 'NOT_IN_CHAIN' });
    });

    it('denies a CO-COACH partner (peer of the owner\'s coach, not in chain)', () => {
      // Co-coach is the owner's coach's peer. Their userId does NOT appear
      // in the upline chain. Mirrors the explicit denial in
      // resolvePublicCapture (analysis.service.js).
      expect(canRetryCapture({
        viewerId: '30', // co-coach
        ownerId: '42',  // member
        coachChain: ['42', '20'], // chain only includes the primary coach (20)
      })).toEqual({ allowed: false, reason: 'NOT_IN_CHAIN' });
    });

    it('denies an anonymous viewer (viewerId missing)', () => {
      expect(canRetryCapture({
        viewerId: null, ownerId: '42', coachChain: ['42'],
      })).toEqual({ allowed: false, reason: 'NO_VIEWER' });
    });

    it('denies an empty-string viewerId', () => {
      expect(canRetryCapture({
        viewerId: '', ownerId: '42', coachChain: ['42'],
      })).toEqual({ allowed: false, reason: 'NO_VIEWER' });
    });

    it('denies when ownerId is missing (defensive guard, not a real flow)', () => {
      expect(canRetryCapture({
        viewerId: '42', ownerId: null, coachChain: [],
      })).toEqual({ allowed: false, reason: 'NO_OWNER' });
    });

    it('denies when coachChain is missing (defaults to [], stranger denied)', () => {
      expect(canRetryCapture({
        viewerId: '99', ownerId: '42',
      })).toEqual({ allowed: false, reason: 'NOT_IN_CHAIN' });
    });

    it('denies a coach AFTER the member has left their team (chain re-fetched, viewer gone)', () => {
      // Caller's responsibility to re-fetch the chain on each request.
      // This test documents that the policy itself trusts the supplied
      // chain — if the coach was removed upstream, they are denied.
      expect(canRetryCapture({
        viewerId: '99', ownerId: '42',
        coachChain: ['42'], // owner no longer has any coach
      })).toEqual({ allowed: false, reason: 'NOT_IN_CHAIN' });
    });
  });
});

describe('assertCanRetryCapture', () => {
  it('returns the decision on success (no throw)', () => {
    const out = assertCanRetryCapture({
      viewerId: '42', ownerId: '42', coachChain: ['42'],
    });
    expect(out).toEqual({ allowed: true, actorRole: 'OWNER' });
  });

  it('throws 401 UNAUTHENTICATED when viewerId missing', () => {
    try {
      assertCanRetryCapture({ viewerId: null, ownerId: '42', coachChain: ['42'] });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.status).toBe(401);
      expect(err.code).toBe('UNAUTHENTICATED');
      expect(err.reason).toBe('NO_VIEWER');
      expect(err.message).toMatch(/Authentication required/);
    }
  });

  it('throws 403 FORBIDDEN_RETRY when viewer present but not in chain', () => {
    try {
      assertCanRetryCapture({ viewerId: '500', ownerId: '42', coachChain: ['42'] });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.status).toBe(403);
      expect(err.code).toBe('FORBIDDEN_RETRY');
      expect(err.reason).toBe('NOT_IN_CHAIN');
    }
  });

  it('throws 403 when ownerId missing (treated as forbidden, not auth)', () => {
    try {
      assertCanRetryCapture({ viewerId: '42', ownerId: null });
      throw new Error('expected throw');
    } catch (err) {
      expect(err.status).toBe(403);
      expect(err.code).toBe('FORBIDDEN_RETRY');
      expect(err.reason).toBe('NO_OWNER');
    }
  });
});
