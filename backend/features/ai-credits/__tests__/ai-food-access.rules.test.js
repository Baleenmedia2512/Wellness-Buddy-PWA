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

const ADMIN_LUNCH = { start: '12:00:00', end: '16:00:00' };
const ADMIN_WINDOWS = {
  breakfast: { enabled: false, start: '05:30:00', end: '08:30:00' },
  lunch: { enabled: true, start: '12:00:00', end: '16:00:00' },
  dinner: { enabled: true, start: '17:30:00', end: '20:30:00' },
};

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
  it('requires an explicit window (no hardcoded default)', () => {
    assert.equal(
      isWithinAiFoodAnalysisWindow(new Date('2026-08-26T06:30:00.000Z'), 'Asia/Kolkata'),
      false,
    );
  });

  it('is open at 12:00 IST when lunch window is passed', () => {
    assert.equal(
      isWithinAiFoodAnalysisWindow(
        new Date('2026-08-26T06:30:00.000Z'),
        'Asia/Kolkata',
        ADMIN_LUNCH,
      ),
      true,
    );
  });

  it('is closed at 11:59 IST for lunch window', () => {
    assert.equal(
      isWithinAiFoodAnalysisWindow(
        new Date('2026-08-26T06:29:00.000Z'),
        'Asia/Kolkata',
        ADMIN_LUNCH,
      ),
      false,
    );
  });
});

describe('isWithinAnyAiFoodAnalysisWindow', () => {
  it('is closed when no windows are provided', () => {
    assert.equal(
      isWithinAnyAiFoodAnalysisWindow(new Date('2026-08-26T12:30:00.000Z'), 'Asia/Kolkata'),
      false,
    );
  });

  it('is open during dinner when dinner window is listed', () => {
    assert.equal(
      isWithinAnyAiFoodAnalysisWindow(
        new Date('2026-08-26T12:30:00.000Z'),
        'Asia/Kolkata',
        [{ start: '17:30:00', end: '20:30:00' }],
      ),
      true,
    );
  });
});

describe('evaluateAiFoodAnalysisAccess', () => {
  it('allows eligible leaf inside admin lunch window', () => {
    const r = evaluateAiFoodAnalysisAccess({
      role: 'user',
      hasDownlineMembers: false,
      coachId: 42,
      now: new Date('2026-08-26T07:00:00.000Z'), // 12:30 IST
      timezoneIana: 'Asia/Kolkata',
      availabilityWindows: ADMIN_WINDOWS,
    });
    assert.deepEqual(r, {
      eligible: true,
      windowOpen: true,
      allowed: true,
      reason: null,
    });
  });

  it('honours custom admin breakfast-only window', () => {
    const r = evaluateAiFoodAnalysisAccess({
      role: 'user',
      hasDownlineMembers: false,
      coachId: 42,
      now: new Date('2026-08-26T01:00:00.000Z'), // 06:30 IST
      timezoneIana: 'Asia/Kolkata',
      availabilityWindows: {
        breakfast: { enabled: true, start: '05:30:00', end: '08:30:00' },
        lunch: { enabled: false, start: '12:00:00', end: '16:00:00' },
        dinner: { enabled: false, start: '17:30:00', end: '20:30:00' },
      },
    });
    assert.equal(r.allowed, true);
    assert.equal(r.windowOpen, true);
  });

  it('denies outside admin windows with outside_ai_window', () => {
    const r = evaluateAiFoodAnalysisAccess({
      role: 'user',
      hasDownlineMembers: false,
      coachId: 42,
      now: new Date('2026-08-26T03:00:00.000Z'), // 08:30 IST — after breakfast if only lunch/dinner on
      timezoneIana: 'Asia/Kolkata',
      availabilityWindows: ADMIN_WINDOWS,
    });
    assert.equal(r.allowed, false);
    assert.equal(r.reason, 'outside_ai_window');
  });

  it('uses availableInWindow boolean when provided', () => {
    const r = evaluateAiFoodAnalysisAccess({
      role: 'user',
      hasDownlineMembers: false,
      coachId: 42,
      availableInWindow: true,
    });
    assert.equal(r.allowed, true);
  });

  it('denies coach with not_eligible_downline', () => {
    const r = evaluateAiFoodAnalysisAccess({
      role: 'coach',
      hasDownlineMembers: true,
      coachId: null,
      now: new Date('2026-08-26T07:00:00.000Z'),
      timezoneIana: 'Asia/Kolkata',
      availabilityWindows: ADMIN_WINDOWS,
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
