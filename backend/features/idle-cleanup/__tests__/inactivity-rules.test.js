/**
 * inactivity-rules.test.js — Unit tests for idle user detection business logic.
 * Per claude.md §9.1: domain layer requires 95% line coverage, 90% branch coverage.
 * 
 * @jest-environment node
 */

import { isUserIdle, getInactivityCutoff, INACTIVITY_THRESHOLD_DAYS } from '../domain/inactivity-rules.js';

describe('idle-cleanup/domain/inactivity-rules', () => {
  describe('INACTIVITY_THRESHOLD_DAYS', () => {
    test('should be 7 days', () => {
      expect(INACTIVITY_THRESHOLD_DAYS).toBe(7);
    });
  });

  describe('isUserIdle()', () => {
    const NOW = new Date('2026-06-04T00:00:00Z');

    test('should return true when LastActiveAt is null', () => {
      const result = isUserIdle(null, NOW);
      expect(result).toBe(true);
    });

    test('should return true when LastActiveAt is undefined', () => {
      const result = isUserIdle(undefined, NOW);
      expect(result).toBe(true);
    });

    test('should return true when LastActiveAt is exactly 7 days ago', () => {
      const sevenDaysAgo = new Date('2026-05-28T00:00:00Z');
      const result = isUserIdle(sevenDaysAgo, NOW);
      expect(result).toBe(true);
    });

    test('should return true when LastActiveAt is more than 7 days ago', () => {
      const eightDaysAgo = new Date('2026-05-27T00:00:00Z');
      const result = isUserIdle(eightDaysAgo, NOW);
      expect(result).toBe(true);
    });

    test('should return true when LastActiveAt is 30 days ago', () => {
      const thirtyDaysAgo = new Date('2026-05-05T00:00:00Z');
      const result = isUserIdle(thirtyDaysAgo, NOW);
      expect(result).toBe(true);
    });

    test('should return false when LastActiveAt is less than 7 days ago', () => {
      const sixDaysAgo = new Date('2026-05-29T00:00:00Z');
      const result = isUserIdle(sixDaysAgo, NOW);
      expect(result).toBe(false);
    });

    test('should return false when LastActiveAt is 6.99 days ago (boundary)', () => {
      const almostSevenDays = new Date(NOW.getTime() - (6.99 * 24 * 60 * 60 * 1000));
      const result = isUserIdle(almostSevenDays, NOW);
      expect(result).toBe(false);
    });

    test('should return false when LastActiveAt is today', () => {
      const result = isUserIdle(NOW, NOW);
      expect(result).toBe(false);
    });

    test('should return false when LastActiveAt is 1 hour ago', () => {
      const oneHourAgo = new Date('2026-06-03T23:00:00Z');
      const result = isUserIdle(oneHourAgo, NOW);
      expect(result).toBe(false);
    });

    test('should return false when LastActiveAt is in the future (clock skew)', () => {
      const future = new Date('2026-06-05T00:00:00Z');
      const result = isUserIdle(future, NOW);
      expect(result).toBe(false);
    });

    test('should accept LastActiveAt as ISO string', () => {
      const eightDaysAgo = '2026-05-27T00:00:00Z';
      const result = isUserIdle(eightDaysAgo, NOW);
      expect(result).toBe(true);
    });

    test('should return true for invalid date string (defensive)', () => {
      const result = isUserIdle('invalid-date', NOW);
      expect(result).toBe(true);
    });

    test('should use current time when now parameter is omitted', () => {
      // Create a date exactly 8 days ago from real "now"
      const realNow = new Date();
      const eightDaysAgo = new Date(realNow);
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      
      const result = isUserIdle(eightDaysAgo);
      expect(result).toBe(true);
    });

    test('edge case: LastActiveAt is exactly at 7-day boundary (168 hours)', () => {
      const exactBoundary = new Date(NOW.getTime() - (7 * 24 * 60 * 60 * 1000));
      const result = isUserIdle(exactBoundary, NOW);
      expect(result).toBe(true);
    });

    test('edge case: LastActiveAt is 1 millisecond before 7-day boundary', () => {
      const justBeforeBoundary = new Date(NOW.getTime() - (7 * 24 * 60 * 60 * 1000) + 1);
      const result = isUserIdle(justBeforeBoundary, NOW);
      expect(result).toBe(false);
    });

    test('edge case: LastActiveAt is 1 millisecond after 7-day boundary', () => {
      const justAfterBoundary = new Date(NOW.getTime() - (7 * 24 * 60 * 60 * 1000) - 1);
      const result = isUserIdle(justAfterBoundary, NOW);
      expect(result).toBe(true);
    });
  });

  describe('getInactivityCutoff()', () => {
    const NOW = new Date('2026-06-04T00:00:00Z');

    test('should return date 7 days before now', () => {
      const cutoff = getInactivityCutoff(NOW);
      const expected = new Date('2026-05-28T00:00:00Z');
      expect(cutoff.toISOString()).toBe(expected.toISOString());
    });

    test('should handle month boundaries', () => {
      const july1 = new Date('2026-07-01T00:00:00Z');
      const cutoff = getInactivityCutoff(july1);
      const expected = new Date('2026-06-24T00:00:00Z');
      expect(cutoff.toISOString()).toBe(expected.toISOString());
    });

    test('should handle year boundaries', () => {
      const jan5 = new Date('2027-01-05T00:00:00Z');
      const cutoff = getInactivityCutoff(jan5);
      const expected = new Date('2026-12-29T00:00:00Z');
      expect(cutoff.toISOString()).toBe(expected.toISOString());
    });

    test('should use current time when now parameter is omitted', () => {
      const realNow = new Date();
      const cutoff = getInactivityCutoff();
      
      const expectedCutoff = new Date(realNow);
      expectedCutoff.setDate(expectedCutoff.getDate() - 7);
      
      // Allow 1 second tolerance for execution time
      const diff = Math.abs(cutoff.getTime() - expectedCutoff.getTime());
      expect(diff).toBeLessThan(1000);
    });

    test('should handle leap year (Feb 29)', () => {
      const mar7LeapYear = new Date('2024-03-07T00:00:00Z'); // 2024 is leap year
      const cutoff = getInactivityCutoff(mar7LeapYear);
      const expected = new Date('2024-02-29T00:00:00Z');
      expect(cutoff.toISOString()).toBe(expected.toISOString());
    });

    test('should return new Date object (not mutate input)', () => {
      const original = new Date('2026-06-04T00:00:00.000Z');
      const cutoff = getInactivityCutoff(original);
      
      expect(cutoff).not.toBe(original);
      expect(original.toISOString()).toBe('2026-06-04T00:00:00.000Z'); // unchanged
    });
  });

  describe('timezone independence', () => {
    test('isUserIdle should work regardless of system timezone', () => {
      // Both dates in different timezone representations but same instant
      const utc = new Date('2026-05-27T00:00:00Z'); // 8 days ago from NOW
      const ist = new Date('2026-05-27T05:30:00+05:30'); // same instant, IST format
      const NOW = new Date('2026-06-04T00:00:00Z');

      expect(isUserIdle(utc, NOW)).toBe(true);
      expect(isUserIdle(ist, NOW)).toBe(true);
      expect(utc.getTime()).toBe(ist.getTime()); // verify same instant
    });

    test('calculation uses millisecond diff, not date arithmetic', () => {
      const NOW = new Date('2026-06-04T12:30:45.678Z'); // mid-day with ms
      const sevenDaysAgo = new Date(NOW.getTime() - (7 * 24 * 60 * 60 * 1000));
      
      const result = isUserIdle(sevenDaysAgo, NOW);
      expect(result).toBe(true);
    });
  });
});
