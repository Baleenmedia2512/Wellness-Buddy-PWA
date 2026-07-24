/**
 * Run: node --test backend/features/background-analysis/__tests__/stale-pending-captures.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STALE_PENDING_MS,
  isStalePendingCapture,
} from '../domain/stale-pending-captures.js';

describe('isStalePendingCapture', () => {
  it('returns false for a recent capture', () => {
    const now = Date.parse('2026-07-24T10:00:00.000Z');
    const capturedAt = '2026-07-24T09:50:00.000Z';
    assert.equal(isStalePendingCapture(capturedAt, now), false);
  });

  it('returns true when age equals STALE_PENDING_MS', () => {
    const now = Date.parse('2026-07-24T10:00:00.000Z');
    const capturedAt = new Date(now - STALE_PENDING_MS).toISOString();
    assert.equal(isStalePendingCapture(capturedAt, now), true);
  });

  it('returns false for invalid timestamps', () => {
    assert.equal(isStalePendingCapture(null, Date.now()), false);
    assert.equal(isStalePendingCapture('not-a-date', Date.now()), false);
  });
});
