/**
 * Unit tests for AI credits availability windows.
 * Run: node --test backend/features/ai-credits/__tests__/availability.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AVAILABILITY_WINDOWS,
  normalizeAvailabilityWindows,
  evaluateAiAvailability,
  timeStringToMinutes,
  isWithinWindowMinutes,
} from '../domain/availability.rules.js';
import { canReserve, normalizeConfig } from '../domain/credits.rules.js';

describe('normalizeAvailabilityWindows', () => {
  it('defaults when raw missing', () => {
    const w = normalizeAvailabilityWindows(null);
    assert.deepEqual(w.breakfast, { ...DEFAULT_AVAILABILITY_WINDOWS.breakfast });
    assert.deepEqual(w.lunch, { ...DEFAULT_AVAILABILITY_WINDOWS.lunch });
    assert.deepEqual(w.dinner, { ...DEFAULT_AVAILABILITY_WINDOWS.dinner });
  });

  it('keeps disabled slots and custom times', () => {
    const w = normalizeAvailabilityWindows({
      breakfast: { enabled: false, start: '06:00', end: '09:00' },
      lunch: { enabled: true, start: '13:00:00', end: '14:30:00' },
    });
    assert.equal(w.breakfast.enabled, false);
    assert.equal(w.breakfast.start, '06:00:00');
    assert.equal(w.breakfast.end, '09:00:00');
    assert.equal(w.lunch.start, '13:00:00');
    assert.equal(w.dinner.enabled, true);
  });
});

describe('evaluateAiAvailability', () => {
  it('allows lunch when lunch enabled', () => {
    const now = new Date('2026-08-27T07:30:00.000Z'); // 13:00 IST
    const result = evaluateAiAvailability({
      now,
      timezoneIana: 'Asia/Kolkata',
      availabilityWindows: {
        breakfast: { enabled: false, start: '05:30:00', end: '08:30:00' },
        lunch: { enabled: true, start: '12:00:00', end: '16:00:00' },
        dinner: { enabled: false, start: '17:30:00', end: '20:30:00' },
      },
    });
    assert.equal(result.availableInWindow, true);
    assert.equal(result.activeMealWindow, 'lunch');
  });

  it('blocks lunch when lunch disabled even inside default hours', () => {
    const now = new Date('2026-08-27T07:30:00.000Z'); // 13:00 IST
    const result = evaluateAiAvailability({
      now,
      timezoneIana: 'Asia/Kolkata',
      availabilityWindows: {
        breakfast: { enabled: true, start: '05:30:00', end: '08:30:00' },
        lunch: { enabled: false, start: '12:00:00', end: '16:00:00' },
        dinner: { enabled: true, start: '17:30:00', end: '20:30:00' },
      },
    });
    assert.equal(result.availableInWindow, false);
    assert.equal(result.activeMealWindow, null);
  });

  it('respects custom breakfast end', () => {
    const now = new Date('2026-08-27T03:00:00.000Z'); // 08:30 IST
    const result = evaluateAiAvailability({
      now,
      timezoneIana: 'Asia/Kolkata',
      availabilityWindows: {
        breakfast: { enabled: true, start: '05:30:00', end: '08:00:00' },
        lunch: { enabled: false, start: '12:00:00', end: '16:00:00' },
        dinner: { enabled: false, start: '17:30:00', end: '20:30:00' },
      },
    });
    assert.equal(result.availableInWindow, false);
  });
});

describe('canReserve outside_window', () => {
  it('rejects when availableInWindow false', () => {
    assert.deepEqual(
      canReserve({
        enabled: true,
        dailyLimit: 3,
        used: 0,
        pendingReservations: 0,
        availableInWindow: false,
      }),
      { allowed: false, reason: 'outside_window' },
    );
  });
});

describe('normalizeConfig includes windows', () => {
  it('always returns normalized availabilityWindows', () => {
    const c = normalizeConfig({ dailyAiCredits: 5, aiModeEnabled: true });
    assert.equal(c.dailyAiCredits, 5);
    assert.equal(c.availabilityWindows.lunch.enabled, true);
    assert.ok(timeStringToMinutes(c.availabilityWindows.lunch.start) != null);
    assert.equal(isWithinWindowMinutes(13 * 60, c.availabilityWindows.lunch), true);
  });

  it('forces AI Mode Off when every meal slot is Off', () => {
    const c = normalizeConfig({
      dailyAiCredits: 3,
      aiModeEnabled: true,
      availabilityWindows: {
        breakfast: { enabled: false, start: '05:30:00', end: '08:30:00' },
        lunch: { enabled: false, start: '12:00:00', end: '16:00:00' },
        dinner: { enabled: false, start: '17:30:00', end: '20:30:00' },
      },
    });
    assert.equal(c.aiModeEnabled, false);
  });
});
