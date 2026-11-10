/**
 * Run: node --test backend/features/payments/__tests__/report-access.handler.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getReportAccess, startReportTrial } from '../api/report-access.handler.js';

describe('startReportTrial', () => {
  it('saves the start once and keeps that window on a second tap', async () => {
    let stored = null;
    const deps = {
      hasPaid: async () => false,
      readStart: async () => stored,
      saveStart: async () => {
        stored = '2026-11-05T02:00:00.000Z';
        return stored;
      },
      todayYmd: '2026-11-05',
    };
    const first = await startReportTrial({ userId: 42 }, deps);
    const second = await startReportTrial({ userId: 42 }, deps);
    assert.equal(first.body.data.access, 'trial');
    assert.equal(first.body.data.daysLeft, 14);
    assert.equal(first.body.data.canSeeDetails, true);
    assert.deepEqual(second.body.data, first.body.data);
  });

  it('does not start a trial for a member who already paid', async () => {
    let saved = false;
    const result = await startReportTrial({ userId: 7 }, {
      hasPaid: async () => true,
      readStart: async () => null,
      saveStart: async () => {
        saved = true;
        return '2026-11-05T02:00:00.000Z';
      },
      todayYmd: '2026-11-05',
    });
    assert.equal(saved, false);
    assert.equal(result.body.data.access, 'premium');
    assert.equal(result.body.data.canSeeDetails, true);
  });
});

describe('getReportAccess', () => {
  it('reports an ended trial without creating a new one', async () => {
    const result = await getReportAccess({ userId: 7 }, {
      hasPaid: async () => false,
      readStart: async () => '2026-11-05T02:00:00.000Z',
      todayYmd: '2026-11-19',
    });
    assert.equal(result.body.data.access, 'ended');
    assert.equal(result.body.data.daysLeft, 0);
    assert.equal(result.body.data.canSeeDetails, false);
  });
});
