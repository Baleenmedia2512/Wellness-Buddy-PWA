/**
 * lunchAutoAi.rules.test.js — admin-configured meal windows + access gates
 * Run: node --test frontend/src/features/ai-credits/__tests__/lunchAutoAi.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  timeStringToMinutes,
  isWithinActivityWindow,
  isWithinEnabledAiWindow,
  decideMealWindowAutoAi,
  decideLunchAutoAi,
  DEFAULT_LUNCH_WINDOW,
  DEFAULT_DINNER_WINDOW,
} from '../domain/lunchAutoAi.rules.js';

describe('timeStringToMinutes', () => {
  it('parses HH:MM:SS', () => {
    assert.equal(timeStringToMinutes('12:00:00'), 12 * 60);
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

  it('is true inside dinner defaults (IST)', () => {
    // 2026-08-20 18:00 IST = 12:30 UTC
    const dinner = new Date('2026-08-20T12:30:00.000Z');
    assert.equal(isWithinActivityWindow(dinner, DEFAULT_DINNER_WINDOW), true);
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
});

describe('decideMealWindowAutoAi', () => {
  const lunchNow = new Date('2026-08-20T07:30:00.000Z'); // 13:00 IST
  const dinnerNow = new Date('2026-08-20T12:30:00.000Z'); // 18:00 IST
  const morningNow = new Date('2026-08-20T04:30:00.000Z'); // 10:00 IST
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
      dinner: { enabled: true, start: '17:30:00', end: '20:30:00' },
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
    assert.equal(d.reason, 'meal-auto');
  });

  it('auto-AI during dinner with remaining credits', () => {
    const d = decideLunchAutoAi({
      now: dinnerNow,
      creditsFlagEnabled: true,
      creditStatus: creditsOk,
    });
    assert.equal(d.shouldAutoAi, true);
    assert.equal(d.reason, 'meal-auto');
  });

  it('manual outside meal window even with credits', () => {
    const d = decideLunchAutoAi({
      now: morningNow,
      creditsFlagEnabled: true,
      creditStatus: creditsOk,
    });
    assert.equal(d.shouldAutoAi, false);
    assert.equal(d.reason, 'outside-meal-window');
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

  it('manual when credits exhausted in lunch', () => {
    const d = decideLunchAutoAi({
      now: lunchNow,
      creditsFlagEnabled: true,
      creditStatus: { ...creditsOk, remaining: 0, used: 3 },
    });
    assert.equal(d.shouldAutoAi, false);
    assert.equal(d.reason, 'exhausted');
  });

  it('manual when backend marks not eligible downline', () => {
    const d = decideLunchAutoAi({
      now: lunchNow,
      creditsFlagEnabled: true,
      creditStatus: {
        ...creditsOk,
        eligibleForAiFoodAnalysis: false,
        aiFoodAnalysisWindowOpen: true,
        aiFoodAnalysisAllowed: false,
        aiFoodAnalysisDenyReason: 'not_eligible_downline',
      },
    });
    assert.equal(d.shouldAutoAi, false);
    assert.equal(d.reason, 'not-eligible-downline');
  });

  it('manual when backend marks AI window closed', () => {
    const d = decideLunchAutoAi({
      now: lunchNow,
      creditsFlagEnabled: true,
      creditStatus: {
        ...creditsOk,
        eligibleForAiFoodAnalysis: true,
        aiFoodAnalysisWindowOpen: false,
        aiFoodAnalysisAllowed: false,
        aiFoodAnalysisDenyReason: 'outside_ai_window',
      },
    });
    assert.equal(d.shouldAutoAi, false);
    assert.equal(d.reason, 'outside-meal-window');
  });
});
