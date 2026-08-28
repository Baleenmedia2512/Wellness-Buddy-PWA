/**
 * Unit tests for AI food-analysis access rules.
 * Run: node --test backend/features/ai-credits/__tests__/ai-food-access.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEligibleAiFoodAnalysisMember,
  isWithinAiFoodAnalysisWindow,
  isWithinAnyAiFoodAnalysisWindow,
  evaluateAiFoodAnalysisAccess,
  shouldEnforceAiFoodAccess,
  AI_FOOD_ACCESS_MIN_APP_VERSION,
} from '../domain/ai-food-access.rules.js';
import { compareSemver } from '../../app-version/domain/version.rules.js';

describe('isEligibleAiFoodAnalysisMember', () => {
  it('allows leaf member under a coach', () => {
    assert.equal(
      isEligibleAiFoodAnalysisMember({ role: 'user', hasDownlineMembers: false, coachId: 10 }),
      true,
    );
  });

  it('blocks coach / upline roles', () => {
    for (const role of ['coach', 'upline', 'coccoach']) {
      assert.equal(
        isEligibleAiFoodAnalysisMember({ role, hasDownlineMembers: false, coachId: 10 }),
        false,
        role,
      );
    }
  });

  it('allows admin and developer (staff bypass)', () => {
    assert.equal(
      isEligibleAiFoodAnalysisMember({ role: 'admin', hasDownlineMembers: true, coachId: null }),
      true,
    );
    assert.equal(
      isEligibleAiFoodAnalysisMember({ role: 'developer', hasDownlineMembers: false, coachId: null }),
      true,
    );
  });

  it('blocks nested leader (has downline) even with Role=user', () => {
    assert.equal(
      isEligibleAiFoodAnalysisMember({ role: 'user', hasDownlineMembers: true, coachId: 10 }),
      false,
    );
  });

  it('blocks users with no CoachId (not a downline)', () => {
    assert.equal(
      isEligibleAiFoodAnalysisMember({ role: 'user', hasDownlineMembers: false, coachId: null }),
      false,
    );
  });
});

describe('isWithinAiFoodAnalysisWindow', () => {
  it('is open at 12:00 IST', () => {
    // 12:00 IST = 06:30 UTC
    assert.equal(
      isWithinAiFoodAnalysisWindow(new Date('2026-08-26T06:30:00.000Z'), 'Asia/Kolkata'),
      true,
    );
  });

  it('is open at 15:59 IST', () => {
    // 15:59 IST = 10:29 UTC
    assert.equal(
      isWithinAiFoodAnalysisWindow(new Date('2026-08-26T10:29:00.000Z'), 'Asia/Kolkata'),
      true,
    );
  });

  it('is closed at 11:59 IST', () => {
    // 11:59 IST = 06:29 UTC
    assert.equal(
      isWithinAiFoodAnalysisWindow(new Date('2026-08-26T06:29:00.000Z'), 'Asia/Kolkata'),
      false,
    );
  });

  it('is closed at 16:01 IST', () => {
    // 16:01 IST = 10:31 UTC
    assert.equal(
      isWithinAiFoodAnalysisWindow(new Date('2026-08-26T10:31:00.000Z'), 'Asia/Kolkata'),
      false,
    );
  });
});

describe('isWithinAnyAiFoodAnalysisWindow', () => {
  it('is open during dinner 18:00 IST', () => {
    // 18:00 IST = 12:30 UTC
    assert.equal(
      isWithinAnyAiFoodAnalysisWindow(new Date('2026-08-26T12:30:00.000Z'), 'Asia/Kolkata'),
      true,
    );
  });

  it('is closed between lunch and dinner (16:30 IST)', () => {
    // 16:30 IST = 11:00 UTC
    assert.equal(
      isWithinAnyAiFoodAnalysisWindow(new Date('2026-08-26T11:00:00.000Z'), 'Asia/Kolkata'),
      false,
    );
  });
});

describe('evaluateAiFoodAnalysisAccess', () => {
  it('allows eligible leaf inside window', () => {
    const r = evaluateAiFoodAnalysisAccess({
      role: 'user',
      hasDownlineMembers: false,
      coachId: 42,
      now: new Date('2026-08-26T07:00:00.000Z'), // 12:30 IST
      timezoneIana: 'Asia/Kolkata',
    });
    assert.deepEqual(r, {
      eligible: true,
      windowOpen: true,
      allowed: true,
      reason: null,
    });
  });

  it('denies outside window with outside_ai_window', () => {
    const r = evaluateAiFoodAnalysisAccess({
      role: 'user',
      hasDownlineMembers: false,
      coachId: 42,
      now: new Date('2026-08-26T03:00:00.000Z'), // 08:30 IST
      timezoneIana: 'Asia/Kolkata',
    });
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'outside_ai_window');
  });

  it('denies coach with not_eligible_downline', () => {
    const r = evaluateAiFoodAnalysisAccess({
      role: 'coach',
      hasDownlineMembers: true,
      coachId: null,
      now: new Date('2026-08-26T07:00:00.000Z'),
      timezoneIana: 'Asia/Kolkata',
    });
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'not_eligible_downline');
  });
});

describe('shouldEnforceAiFoodAccess', () => {
  it('does not enforce when version missing (legacy)', () => {
    assert.equal(shouldEnforceAiFoodAccess(null, compareSemver), false);
    assert.equal(shouldEnforceAiFoodAccess('', compareSemver), false);
  });

  it(`enforces at/above ${AI_FOOD_ACCESS_MIN_APP_VERSION}`, () => {
    assert.equal(shouldEnforceAiFoodAccess('3.4.7', compareSemver), true);
    assert.equal(shouldEnforceAiFoodAccess('3.5.0', compareSemver), true);
  });

  it('does not enforce below min version', () => {
    assert.equal(shouldEnforceAiFoodAccess('3.4.6', compareSemver), false);
  });
});
