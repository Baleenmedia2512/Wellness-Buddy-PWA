/**
 * lunchAutoAi.rules.test.js
 * Run: node --test frontend/src/features/ai-credits/__tests__/lunchAutoAi.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  timeStringToMinutes,
  isWithinActivityWindow,
  decideLunchAutoAi,
  DEFAULT_LUNCH_WINDOW,
} from '../domain/lunchAutoAi.rules.js';

describe('timeStringToMinutes', () => {
  it('parses HH:MM:SS', () => {
    assert.equal(timeStringToMinutes('12:00:00'), 12 * 60);
    assert.equal(timeStringToMinutes('16:00:00'), 16 * 60);
  });
});

describe('isWithinActivityWindow', () => {
  it('is true inside lunch defaults (IST)', () => {
    // 2026-08-20 13:00 IST = 07:30 UTC
    const noonish = new Date('2026-08-20T07:30:00.000Z');
    assert.equal(isWithinActivityWindow(noonish, DEFAULT_LUNCH_WINDOW), true);
  });

  it('is false outside lunch (IST)', () => {
    // 2026-08-20 10:00 IST = 04:30 UTC
    const morning = new Date('2026-08-20T04:30:00.000Z');
    assert.equal(isWithinActivityWindow(morning, DEFAULT_LUNCH_WINDOW), false);
  });
});

describe('decideLunchAutoAi', () => {
  const lunchNow = new Date('2026-08-20T07:30:00.000Z'); // 13:00 IST
  const morningNow = new Date('2026-08-20T04:30:00.000Z'); // 10:00 IST
  const creditsOk = {
    enabled: true,
    dailyLimit: 3,
    used: 1,
    pending: 0,
    remaining: 2,
  };

  it('always hides AI button', () => {
    const d = decideLunchAutoAi({
      now: lunchNow,
      creditsFlagEnabled: true,
      creditStatus: creditsOk,
    });
    assert.equal(d.hideAiButton, true);
  });

  it('auto-AI during lunch with remaining credits', () => {
    const d = decideLunchAutoAi({
      now: lunchNow,
      lunchWindow: DEFAULT_LUNCH_WINDOW,
      creditsFlagEnabled: true,
      creditStatus: creditsOk,
    });
    assert.equal(d.shouldAutoAi, true);
    assert.equal(d.reason, 'lunch-auto');
  });

  it('manual outside lunch even with credits', () => {
    const d = decideLunchAutoAi({
      now: morningNow,
      creditsFlagEnabled: true,
      creditStatus: creditsOk,
    });
    assert.equal(d.shouldAutoAi, false);
    assert.equal(d.reason, 'outside-lunch');
  });

  it('manual when credits exhausted in lunch', () => {
    const d = decideLunchAutoAi({
      now: lunchNow,
      creditsFlagEnabled: true,
      creditStatus: {
        enabled: true,
        dailyLimit: 2,
        used: 2,
        pending: 0,
        remaining: 0,
      },
    });
    assert.equal(d.shouldAutoAi, false);
    assert.equal(d.reason, 'exhausted');
  });

  it('manual when credits flag off', () => {
    const d = decideLunchAutoAi({
      now: lunchNow,
      creditsFlagEnabled: false,
      creditStatus: creditsOk,
    });
    assert.equal(d.shouldAutoAi, false);
    assert.equal(d.reason, 'credits-flag-off');
  });
});
