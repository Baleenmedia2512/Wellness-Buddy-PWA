/**
 * Post-capture navigation: Phase 1 success opens Manual Entry.
 * Lunch auto-AI (if any) is decided inside ManualEntryPage via decideLunchAutoAi —
 * App does not start AI here.
 * Run: node --test frontend/src/shell/__tests__/manualEntryNav.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideLunchAutoAi,
  DEFAULT_LUNCH_WINDOW,
} from '../../features/ai-credits/domain/lunchAutoAi.rules.js';

/**
 * Pure decision used after Phase 1 capture persist succeeds.
 * Always open Manual Entry; never start AI at the App shell layer.
 */
export function buildPostCaptureNavigation({ captureId, imageBase64, userId }) {
  if (!captureId || !imageBase64) {
    return { openManualEntry: false, runAutoAi: false, payload: null };
  }
  return {
    openManualEntry: true,
    runAutoAi: false,
    payload: { captureId, imageBase64, userId: userId ?? null },
  };
}

describe('buildPostCaptureNavigation', () => {
  it('opens Manual Entry and does not start AI at App layer', () => {
    const nav = buildPostCaptureNavigation({
      captureId: 42,
      imageBase64: 'data:image/jpeg;base64,abc',
      userId: 7,
    });
    assert.equal(nav.openManualEntry, true);
    assert.equal(nav.runAutoAi, false);
    assert.deepEqual(nav.payload, {
      captureId: 42,
      imageBase64: 'data:image/jpeg;base64,abc',
      userId: 7,
    });
  });

  it('skips when capture missing', () => {
    const nav = buildPostCaptureNavigation({
      captureId: null,
      imageBase64: 'x',
      userId: 1,
    });
    assert.equal(nav.openManualEntry, false);
    assert.equal(nav.runAutoAi, false);
  });
});

describe('lunch auto-AI after Manual Entry opens', () => {
  const lunchNow = new Date('2026-08-20T07:30:00.000Z'); // 13:00 IST
  const creditsOk = {
    enabled: true,
    dailyLimit: 3,
    used: 0,
    pending: 0,
    remaining: 3,
  };

  it('Manual Entry may auto-AI during lunch with credits (hide button)', () => {
    const d = decideLunchAutoAi({
      now: lunchNow,
      lunchWindow: DEFAULT_LUNCH_WINDOW,
      creditsFlagEnabled: true,
      creditStatus: creditsOk,
    });
    assert.equal(d.hideAiButton, true);
    assert.equal(d.shouldAutoAi, true);
  });
});
