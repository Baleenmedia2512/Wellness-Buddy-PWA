/**
 * Run: node --test backend/features/weight/__tests__/ideal-weight-milestone.service.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { maybeRecordIdealWeightMilestone } from '../ideal-weight-milestone.service.js';

describe('maybeRecordIdealWeightMilestone', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FF_REPORTS_MODULE = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function makeDeps(overrides = {}) {
    const state = {
      reachedAt: null,
      notifiedAt: null,
      emails: [],
    };
    const contacts = {
      10: { email: 'l1-coach@example.com', name: 'L1 Coach' },
      11: { email: 'l1-cocoach@example.com', name: 'L1 CoCoach' },
      20: { email: 'l2-coach@example.com', name: 'L2 Coach' },
      21: { email: 'l2-cocoach@example.com', name: 'L2 CoCoach' },
      30: { email: 'l3-coach@example.com', name: 'L3 Coach' },
      31: { email: 'l3-cocoach@example.com', name: 'L3 CoCoach' },
    };
    return {
      state,
      deps: {
        getIdealWeightReachedAt: async () => state.reachedAt,
        listActiveWeightsAsc: async () => [
          { ID: 1, Weight: 80, CreatedAt: '2024-01-01T00:00:00.000Z' },
          { ID: 2, Weight: 60, CreatedAt: '2024-06-01T00:00:00.000Z' },
        ],
        claimIdealWeightReachedAt: async (_userId, iso) => {
          if (state.reachedAt) return false;
          state.reachedAt = iso;
          return true;
        },
        claimIdealWeightReachedNotify: async () => {
          if (state.notifiedAt) return false;
          state.notifiedAt = new Date().toISOString();
          return true;
        },
        findMemberCoachContext: async () => ({
          coachId: 10,
          memberName: 'Alice',
          heightCm: 170,
        }),
        listCoachAncestorIdsForNotify: async () => ['10', '20', '30'],
        findLeadPartnersByUserIds: async () => new Map([
          [10, 11],
          [20, 21],
          [30, 31],
        ]),
        findCoachContact: async (id) => contacts[String(id)] || { email: null, name: null },
        sendCoachEmail: async (payload) => {
          state.emails.push(payload);
          return { success: true };
        },
        ...overrides,
      },
    };
  }

  it('stamps and emails coach + cocoach up to 3 levels when insert is first in-range', async () => {
    const { state, deps } = makeDeps({
      listActiveWeightsAsc: async () => [
        { ID: 2, Weight: 60, CreatedAt: '2024-06-01T00:00:00.000Z' },
      ],
    });
    const result = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 60,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 2,
      newEntryCreatedAt: '2024-06-01T00:00:00.000Z',
    }, deps);

    assert.equal(result.recorded, true);
    assert.equal(result.notified, true);
    assert.equal(result.reason, 'sent');
    assert.equal(result.emailed, 6);
    assert.ok(state.reachedAt);
    assert.equal(state.emails.length, 6);
    assert.match(state.emails[0].subject, /reached ideal weight/i);
    assert.match(state.emails[0].text, /Co-Coach|Coach/);
  });

  it('dedupes when coach and cocoach share an email', async () => {
    const { state, deps } = makeDeps({
      listActiveWeightsAsc: async () => [
        { ID: 2, Weight: 60, CreatedAt: '2024-06-01T00:00:00.000Z' },
      ],
      listCoachAncestorIdsForNotify: async () => ['10'],
      findLeadPartnersByUserIds: async () => new Map([[10, 11]]),
      findCoachContact: async (id) => {
        if (String(id) === '10' || String(id) === '11') {
          return { email: 'shared@example.com', name: 'Shared' };
        }
        return { email: null, name: null };
      },
    });
    const result = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 60,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 2,
      newEntryCreatedAt: '2024-06-01T00:00:00.000Z',
    }, deps);
    assert.equal(result.emailed, 1);
    assert.equal(state.emails.length, 1);
  });

  it('records historical first without email when earlier in-range exists', async () => {
    const { state, deps } = makeDeps();
    const result = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 59,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 99,
      newEntryCreatedAt: '2024-07-01T00:00:00.000Z',
    }, deps);

    assert.equal(result.recorded, true);
    assert.equal(result.notified, false);
    assert.equal(result.reason, 'recorded_historical_first');
    assert.equal(state.emails.length, 0);
  });

  it('skips edits and out-of-range inserts', async () => {
    const { deps } = makeDeps();
    const edit = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 60,
      heightCm: 170,
      isNewInsert: false,
      newEntryId: 2,
    }, deps);
    assert.equal(edit.reason, 'not_new_insert');

    const out = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 90,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 3,
    }, deps);
    assert.equal(out.reason, 'not_in_ideal_range');
  });

  it('dedupes notify claim', async () => {
    const { deps } = makeDeps({
      listActiveWeightsAsc: async () => [
        { ID: 2, Weight: 60, CreatedAt: '2024-06-01T00:00:00.000Z' },
      ],
      claimIdealWeightReachedNotify: async () => false,
    });
    const result = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 60,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 2,
      newEntryCreatedAt: '2024-06-01T00:00:00.000Z',
    }, deps);
    assert.equal(result.recorded, true);
    assert.equal(result.notified, false);
    assert.equal(result.reason, 'notify_already_claimed');
  });
});
