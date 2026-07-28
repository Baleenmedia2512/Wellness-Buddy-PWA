/**
 * Run: node --test backend/features/background-analysis/__tests__/stale-pending-captures.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STALE_PENDING_MS,
  isStalePendingCapture,
  resolvePendingCaptureDisplay,
} from '../domain/stale-pending-captures.js';

describe('isStalePendingCapture', () => {
  it('returns false for a recent capture', () => {
    const now = Date.parse('2026-07-24T10:00:00.000Z');
    const capturedAt = '2026-07-24T09:58:00.000Z';
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

describe('resolvePendingCaptureDisplay', () => {
  it('keeps recent uploads in the analyzing state', () => {
    const capturedAt = '2026-07-24T08:00:00.000Z';
    const now = Date.parse('2026-07-24T08:01:00.000Z');
    assert.deepEqual(resolvePendingCaptureDisplay(capturedAt, now), {
      stale: false,
      isPendingAnalysis: true,
      displayImageType: 'pending',
    });
  });

  it('surfaces abandoned uploads as unknown (Manual Log)', () => {
    const capturedAt = '2026-07-24T08:00:00.000Z';
    const now = Date.parse(capturedAt) + STALE_PENDING_MS + 1_000;
    assert.deepEqual(resolvePendingCaptureDisplay(capturedAt, now), {
      stale: true,
      isPendingAnalysis: false,
      displayImageType: 'unknown',
    });
  });
});
