/**
 * lunchAutoAi.rules.test.js — admin-configured meal windows
 * Run: node --test frontend/src/features/ai-credits/__tests__/lunchAutoAi.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  timeStringToMinutes,
  isWithinActivityWindow,
  isWithinEnabledAiWindow,
  decideMealWindowAutoAi,
  DEFAULT_LUNCH_WINDOW,
} from '../domain/lunchAutoAi.rules.js';

describe('timeStringToMinutes', () => {
  it('parses HH:MM:SS', () => {
    assert.equal(timeStringToMinutes('12:00:00'), 12 * 60);
  });
});

describe('isWithinEnabledAiWindow', () => {
  const lunchNow = new Date('2026-08-20T07:30:00.000Z'); // 13:00 IST
  const midMorning = new Date('2026-08-20T04:30:00.000Z'); // 10:00 IST

  it('true when lunch enabled and inside lunch', () => {
    assert.equal(
      isWithinEnabledAiWindow(lunchNow, {
        breakfast: { enabled: false, start: '05:30:00', end: '08:30:00' },
        lunch: { enabled: true, start: '12:00:00', end: '16:00:00' },
        dinner: { enabled: false, start: '17:30:00', end: '20:30:00' },
      }),
      true,
    );
  });

  it('false when lunch disabled even inside lunch hours', () => {
    assert.equal(
      isWithinEnabledAiWindow(lunchNow, {
        breakfast: { enabled: false, start: '05:30:00', end: '08:30:00' },
        lunch: { enabled: false, start: '12:00:00', end: '16:00:00' },
        dinner: { enabled: false, start: '17:30:00', end: '20:30:00' },
      }),
      false,
    );
  });

  it('false mid-morning with defaults', () => {
    assert.equal(isWithinEnabledAiWindow(midMorning, null), false);
  });

  it('respects activity window helper', () => {
    assert.equal(isWithinActivityWindow(lunchNow, DEFAULT_LUNCH_WINDOW), true);
  });
});

describe('decideMealWindowAutoAi', () => {
  const lunchNow = new Date('2026-08-20T07:30:00.000Z');
  const creditsOk = {
    enabled: true,
    dailyLimit: 3,
    used: 0,
    pending: 0,
    remaining: 3,
    availableInWindow: true,
    availabilityWindows: {
      breakfast: { enabled: false, start: '05:30:00', end: '08:30:00' },
      lunch: { enabled: true, start: '12:00:00', end: '16:00:00' },
      dinner: { enabled: false, start: '17:30:00', end: '20:30:00' },
    },
  };

  it('auto-AI when status says in-window with credits', () => {
    const d = decideMealWindowAutoAi({
      now: lunchNow,
      creditsFlagEnabled: true,
      creditStatus: creditsOk,
    });
    assert.equal(d.shouldAutoAi, true);
    assert.equal(d.hideAiButton, true);
  });

  it('manual when availableInWindow false', () => {
    const d = decideMealWindowAutoAi({
      now: lunchNow,
      creditsFlagEnabled: true,
      creditStatus: { ...creditsOk, availableInWindow: false },
    });
    assert.equal(d.shouldAutoAi, false);
    assert.equal(d.reason, 'outside-meal-window');
  });
});
