/**
 * Frontend unit tests for AI Mode button visibility from status API values.
 * Run: node --test frontend/src/features/ai-credits/__tests__/aiModeVisibility.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure helper mirroring ManualEntryPage AI Mode enablement rules.
 * Status comes from API only — never hardcode dailyLimit here.
 */
export function isAiModeButtonEnabled(status, { running = false } = {}) {
  if (running) return false;
  if (!status) return false;
  if (!status.enabled) return false;
  if ((status.remaining ?? 0) <= 0) return false;
  return true;
}

export function aiModeButtonLabel(status, { running = false } = {}) {
  if (running) return 'Analysing…';
  if (!status) return 'AI Mode';
  if (!status.enabled) return 'AI Mode disabled';
  if ((status.remaining ?? 0) <= 0) return 'Daily AI limit reached';
  return 'AI Mode';
}

describe('isAiModeButtonEnabled', () => {
  it('enabled when remaining > 0', () => {
    assert.equal(
      isAiModeButtonEnabled({ enabled: true, remaining: 2, dailyLimit: 3, used: 1 }),
      true,
    );
  });

  it('disabled at limit', () => {
    assert.equal(
      isAiModeButtonEnabled({ enabled: true, remaining: 0, dailyLimit: 3, used: 3 }),
      false,
    );
  });

  it('disabled when AI mode off', () => {
    assert.equal(
      isAiModeButtonEnabled({ enabled: false, remaining: 3, dailyLimit: 3, used: 0 }),
      false,
    );
  });
});

describe('aiModeButtonLabel', () => {
  it('shows limit reached from API remaining', () => {
    assert.equal(
      aiModeButtonLabel({ enabled: true, remaining: 0, dailyLimit: 3, used: 3 }),
      'Daily AI limit reached',
    );
  });
});
