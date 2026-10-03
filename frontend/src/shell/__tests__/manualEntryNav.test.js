/**
 * manualEntryNav.test.js — Food tap AI uses admin availability windows only
 * (decideLunchAutoAi) — App does not start AI on upload.
 * Run: node --test frontend/src/shell/__tests__/manualEntryNav.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideLunchAutoAi,
} from '../../features/ai-credits/domain/lunchAutoAi.rules.js';

describe('Food AI eligibility after Manual Entry opens', () => {
  const lunchNow = new Date('2026-08-20T07:30:00.000Z'); // 13:00 IST
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

  it('Food tap may start AI when admin window + credits say yes', () => {
    const d = decideLunchAutoAi({
      now: lunchNow,
      creditsFlagEnabled: true,
      creditStatus: creditsOk,
    });
    assert.equal(d.hideAiButton, true);
    assert.equal(d.shouldAutoAi, true);
  });
});
