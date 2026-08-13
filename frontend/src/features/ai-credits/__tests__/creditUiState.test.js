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
    assert.equal(ui.leftToday, 2);
  });

  it('busy when pending holds block but nothing consumed yet', () => {
    const ui = getAiCreditUiState({
      enabled: true,
      dailyLimit: 2,
      used: 0,
      pending: 2,
      remaining: 0,
    });
    assert.equal(ui.phase, 'busy');
    assert.equal(ui.leftToday, 2);
  });

  it('exhausted only when used reaches limit', () => {
    const ui = getAiCreditUiState({
      enabled: true,
      dailyLimit: 2,
      used: 2,
      pending: 0,
      remaining: 0,
    });
    assert.equal(ui.phase, 'exhausted');
    assert.equal(ui.leftToday, 0);
  });
});

describe('reserveFailureMessage', () => {
  it('uses calm copy for pending holds', () => {
    assert.match(reserveFailureMessage('pending_holds'), /temporarily unavailable/i);
    assert.match(reserveFailureMessage('pending_holds'), /not used yet/i);
  });

  it('uses midnight copy only for daily exhaustion', () => {
    assert.match(reserveFailureMessage('daily_exhausted'), /midnight/i);
  });
});

describe('isAutoDetectEnabled', () => {
  it('allows retry while busy', () => {
    const ui = getAiCreditUiState({
      enabled: true,
      dailyLimit: 2,
      used: 0,
      pending: 2,
      remaining: 0,
    });
    assert.equal(isAutoDetectEnabled(ui), true);
  });

  it('blocks when exhausted', () => {
    const ui = getAiCreditUiState({
      enabled: true,
      dailyLimit: 2,
      used: 2,
      pending: 0,
      remaining: 0,
    });
    assert.equal(isAutoDetectEnabled(ui), false);
  });
});
