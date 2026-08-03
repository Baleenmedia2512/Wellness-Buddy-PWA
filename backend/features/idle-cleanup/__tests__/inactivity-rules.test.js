/**
 * Unit tests for idle return-notify domain rules.
 * Run: node --test backend/features/idle-cleanup/__tests__/inactivity-rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INACTIVITY_THRESHOLD_DAYS,
  idleDaysSince,
  isUserIdle,
  shouldNotifyCoachOnReturn,
  getInactivityCutoff,
} from '../domain/inactivity-rules.js';

describe('inactivity-rules (ADR-0007)', () => {
  const now = new Date('2026-08-03T12:00:00Z');

  it('exports a 7-day threshold', () => {
    assert.equal(INACTIVITY_THRESHOLD_DAYS, 7);
  });

  describe('shouldNotifyCoachOnReturn', () => {
    it('is false when lastActiveAt is missing (no proven gap)', () => {
      assert.equal(shouldNotifyCoachOnReturn(null, now), false);
      assert.equal(shouldNotifyCoachOnReturn(undefined, now), false);
    });

    it('is false when idle less than 7 days', () => {
      assert.equal(
        shouldNotifyCoachOnReturn(new Date('2026-07-30T12:00:00Z'), now),
        false,
      );
    });

    it('is true when idle exactly 7 days', () => {
      assert.equal(
        shouldNotifyCoachOnReturn(new Date('2026-07-27T12:00:00Z'), now),
        true,
      );
    });

    it('is true when idle more than 7 days', () => {
      assert.equal(
        shouldNotifyCoachOnReturn(new Date('2026-07-01T12:00:00Z'), now),
        true,
      );
    });

    it('is false for future lastActiveAt (clock skew)', () => {
      assert.equal(
        shouldNotifyCoachOnReturn(new Date('2026-08-04T12:00:00Z'), now),
        false,
      );
    });
  });

  describe('idleDaysSince', () => {
    it('returns floored whole days', () => {
      assert.equal(idleDaysSince(new Date('2026-07-27T12:00:00Z'), now), 7);
      assert.equal(idleDaysSince(new Date('2026-07-26T18:00:00Z'), now), 7);
    });

    it('returns null for missing timestamps', () => {
      assert.equal(idleDaysSince(null, now), null);
    });
  });

  describe('isUserIdle', () => {
    it('treats null lastActiveAt as idle (detection helper)', () => {
      assert.equal(isUserIdle(null, now), true);
    });

    it('matches the 7-day threshold for known timestamps', () => {
      assert.equal(isUserIdle(new Date('2026-07-27T12:00:00Z'), now), true);
      assert.equal(isUserIdle(new Date('2026-07-28T12:00:00Z'), now), false);
    });
  });

  describe('getInactivityCutoff', () => {
    it('returns now minus threshold days', () => {
      const cutoff = getInactivityCutoff(now);
      assert.equal(cutoff.toISOString(), '2026-07-27T12:00:00.000Z');
    });
  });
});
