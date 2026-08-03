/**
 * Post-capture navigation: Phase 1 success opens Manual Entry (no auto-AI).
 * Run: node --test frontend/src/shell/__tests__/manualEntryNav.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure decision used after Phase 1 capture persist succeeds.
 * Auto-AI / orchestrate must not run; Manual Entry opens with capture payload.
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
  it('opens Manual Entry and never auto-AI after Phase 1', () => {
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
