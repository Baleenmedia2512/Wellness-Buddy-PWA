/**
 * Run: node --test backend/features/payments/__tests__/events-access.handler.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getEventsAccess, startEventsTrial } from '../api/events-access.handler.js';

describe('startEventsTrial (shared report trial)', () => {
  it('uses the same 14-day start as Reports and keeps that window on a second tap', async () => {
    let stored = null;
    const deps = {
      hasPaid: async () => false,
      readStart: async () => stored,
      saveStart: async () => {
        stored = '2026-11-12T02:00:00.000Z';
        return stored;
      },
      todayYmd: '2026-11-12',
    };
    const first = await startEventsTrial({ userId: 42 }, deps);
    const second = await startEventsTrial({ userId: 42 }, deps);
    assert.equal(first.body.data.access, 'trial');
    assert.equal(first.body.data.daysLeft, 14);
    assert.equal(first.body.data.canUseHostTools, true);
    assert.deepEqual(second.body.data, first.body.data);
  });

  it('continues remaining days when Reports trial already started', async () => {
    const result = await getEventsAccess({ userId: 7 }, {
      hasPaid: async () => false,
      // Started 7 India days ago → 7 days left of the shared 14-day trial
      readStart: async () => '2026-11-05T02:00:00.000Z',
      todayYmd: '2026-11-12',
    });
    assert.equal(result.body.data.access, 'trial');
    assert.equal(result.body.data.daysLeft, 7);
    assert.equal(result.body.data.canUseHostTools, true);
  });

  it('does not start a trial for a member who already paid', async () => {
    let saved = false;
    const result = await startEventsTrial({ userId: 7 }, {
      hasPaid: async () => true,
      readStart: async () => null,
      saveStart: async () => {
        saved = true;
        return '2026-11-12T02:00:00.000Z';
      },
      todayYmd: '2026-11-12',
    });
    assert.equal(saved, false);
    assert.equal(result.body.data.access, 'premium');
    assert.equal(result.body.data.canUseHostTools, true);
  });
});

describe('getEventsAccess', () => {
  it('reports an ended shared trial without creating a new one', async () => {
    const result = await getEventsAccess({ userId: 7 }, {
      hasPaid: async () => false,
      readStart: async () => '2026-11-05T02:00:00.000Z',
      todayYmd: '2026-11-19',
    });
    assert.equal(result.body.data.access, 'ended');
    assert.equal(result.body.data.daysLeft, 0);
    assert.equal(result.body.data.canUseHostTools, false);
  });
});
