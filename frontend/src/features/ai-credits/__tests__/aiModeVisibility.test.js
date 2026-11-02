/**
 * Frontend unit tests for AI Mode button visibility from status API values.
 * Run: node --test frontend/src/features/ai-credits/__tests__/aiModeVisibility.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAiCreditUiState,
  isAutoDetectEnabled,
  autoDetectButtonLabel,
  autoDetectButtonSubtitle,
} from '../domain/creditUiState.js';

/** @deprecated use isAutoDetectEnabled from creditUiState.js */
export function isAiModeButtonEnabled(status, { running = false } = {}) {
  return isAutoDetectEnabled(getAiCreditUiState(status), { running });
}

/** @deprecated use autoDetectButtonLabel from creditUiState.js */
export function aiModeButtonLabel(status, { running = false } = {}) {
  return autoDetectButtonLabel(getAiCreditUiState(status), { running });
}

describe('isAiModeButtonEnabled', () => {
  it('enabled when remaining > 0', () => {
    assert.equal(
      isAiModeButtonEnabled({ enabled: true, remaining: 2, dailyLimit: 3, used: 1 }),
      true,
    );
  });

  it('still enabled while busy (pending holds)', () => {
    assert.equal(
      isAiModeButtonEnabled({
        enabled: true,
        remaining: 0,
        dailyLimit: 2,
        used: 0,
        pending: 2,
      }),
      true,
    );
  });

  it('disabled when daily detections fully used', () => {
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
  it('shows unlock only when exhausted', () => {
    assert.equal(
      aiModeButtonLabel({ enabled: true, remaining: 0, dailyLimit: 3, used: 3 }),
      'Unlock on',
    );
  });

  it('shows try again when busy', () => {
    const ui = getAiCreditUiState({
      enabled: true,
      remaining: 0,
      dailyLimit: 2,
      used: 0,
      pending: 2,
    });
    assert.equal(autoDetectButtonLabel(ui), 'Unavailable');
    assert.equal(autoDetectButtonSubtitle(ui), 'Try again later');
  });
});
