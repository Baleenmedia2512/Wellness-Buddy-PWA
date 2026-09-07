/**
 * Frontend unit tests for AI credit UX state helpers.
 * Run: node --test frontend/src/features/ai-credits/__tests__/creditUiState.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAiCreditUiState,
  reserveFailureMessage,
  isAutoDetectEnabled,
} from '../domain/creditUiState.js';

describe('getAiCreditUiState', () => {
  it('available when remaining > 0', () => {
    const ui = getAiCreditUiState({
      enabled: true,
      dailyLimit: 2,
      used: 0,
      pending: 0,
      remaining: 2,
    });
    assert.equal(ui.phase, 'available');
  });

  it('outside_window when availableInWindow is false', () => {
    const ui = getAiCreditUiState({
      enabled: true,
      dailyLimit: 3,
      used: 0,
      pending: 0,
      remaining: 3,
      availableInWindow: false,
    });
    assert.equal(ui.phase, 'outside_window');
  });
});

describe('reserveFailureMessage', () => {
  it('explains meal-time restriction for outside_window', () => {
    assert.match(reserveFailureMessage('outside_window'), /meal times/i);
  });
});

describe('isAutoDetectEnabled', () => {
  it('blocks outside meal window', () => {
    const ui = getAiCreditUiState({
      enabled: true,
      dailyLimit: 2,
      used: 0,
      pending: 0,
      remaining: 2,
      availableInWindow: false,
    });
    assert.equal(isAutoDetectEnabled(ui), false);
  });
});
