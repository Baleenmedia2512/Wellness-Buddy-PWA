/**
 * Diary feed deduplication tests.
 * Run: node --test backend/features/background-analysis/__tests__/diary-feed-dedup.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dedupePendingDiaryEntries } from '../domain/diary-feed-dedup.js';

describe('dedupePendingDiaryEntries', () => {
  it('drops pending-analysis row when a food row exists for the same capture', () => {
    const food = {
      kind: 'food',
      capturedAt: '2026-07-24T05:23:00.000Z',
      capture: { id: 'cap-vadam' },
      payload: { id: 10 },
    };
    const pending = {
      kind: 'unknown',
      capturedAt: '2026-07-24T05:23:00.000Z',
      capture: { id: 'cap-vadam', type: 'pending' },
      payload: { id: 'cap-vadam', isPendingAnalysis: true },
    };

    const deduped = dedupePendingDiaryEntries([food, pending]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].kind, 'food');
  });

  it('keeps pending-analysis row when no terminal entry shares the capture ID', () => {
    const pending = {
      kind: 'unknown',
      capturedAt: '2026-07-24T05:23:00.000Z',
      capture: { id: 'cap-pending', type: 'pending' },
      payload: { id: 'cap-pending', isPendingAnalysis: true },
    };

    const deduped = dedupePendingDiaryEntries([pending]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].payload.isPendingAnalysis, true);
  });

  it('keeps unrelated pending rows when another capture is already resolved', () => {
    const food = {
      kind: 'food',
      capturedAt: '2026-07-24T05:23:00.000Z',
      capture: { id: 'cap-payasam' },
      payload: { id: 10 },
    };
    const pendingStill = {
      kind: 'unknown',
      capturedAt: '2026-07-24T05:23:00.000Z',
      capture: { id: 'cap-dish2', type: 'pending' },
      payload: { id: 'cap-dish2', isPendingAnalysis: true },
    };
    const pendingDone = {
      kind: 'unknown',
      capturedAt: '2026-07-24T05:23:00.000Z',
      capture: { id: 'cap-payasam', type: 'pending' },
      payload: { id: 'cap-payasam', isPendingAnalysis: true },
    };

    const deduped = dedupePendingDiaryEntries([food, pendingStill, pendingDone]);
    assert.equal(deduped.length, 2);
    assert.ok(deduped.some((e) => e.kind === 'food'));
    assert.ok(deduped.some((e) => e.capture?.id === 'cap-dish2'));
    assert.ok(!deduped.some((e) => e.capture?.id === 'cap-payasam' && e.payload?.isPendingAnalysis));
  });

  it('collapses duplicate pending-analysis rows for the same capture ID', () => {
    const pendingA = {
      kind: 'unknown',
      capturedAt: '2026-07-24T05:23:00.000Z',
      capture: { id: 'cap-dosa', type: 'pending' },
      payload: { id: 'cap-dosa', isPendingAnalysis: true },
    };
    const pendingB = {
      kind: 'unknown',
      capturedAt: '2026-07-24T05:23:00.000Z',
      capture: { id: 'cap-dosa', type: 'pending' },
      payload: { id: 'cap-dosa', isPendingAnalysis: true },
    };

    const deduped = dedupePendingDiaryEntries([pendingA, pendingB]);
    assert.equal(deduped.length, 1);
  });
});
